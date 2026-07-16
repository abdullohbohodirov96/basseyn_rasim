import { prisma } from "../../prisma";
import { assertCanAccessObject, can } from "../../auth";
import { writeAuditLog } from "../../audit";
import { uploadObject, getSignedDownloadUrl } from "../../r2";
import { generatePreview, sha256Hex, isSupportedImageMime, guessMimeFromFilename, readDimensions } from "../../image";
import { buildOriginalKey, buildPreviewKey, formatDateTashkent, formatTimeTashkent, escapeHtml } from "../../utils";
import { MAX_UPLOAD_SIZE_BYTES } from "../../env";
import { setSession, getSession, clearSession, SessionState } from "../../session";
import { sendMessage, sendPhoto, getFile, downloadTelegramFile } from "../client";
import { TXT, BTN } from "../text";
import { objectMenuKeyboard } from "../keyboards";
import { photoNavigationKeyboard } from "../keyboards";
import type { User } from "@prisma/client";
import type { TelegramMessage, TelegramPhotoSize, TelegramDocument } from "../types";

const PAGE_SIZE = 10;

export async function startPhotoUpload(chatId: number, telegramId: string, user: User, objectId: string) {
  if (!can.uploadPhotos(user)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  const allowed = await assertCanAccessObject(user, objectId);
  if (!allowed) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await setSession(telegramId, {
    state: SessionState.AWAITING_PHOTO_UPLOAD,
    selectedObjectId: objectId,
    temporaryData: { uploadedPhotoIds: [] },
  });
  await sendMessage(chatId, TXT.askPhoto);
}

interface IncomingFile {
  fileId: string;
  fileUniqueId: string;
  filename: string;
  mimeType: string | null;
  fileSize?: number;
}

function extractIncomingFile(message: TelegramMessage): IncomingFile | null {
  if (message.photo && message.photo.length > 0) {
    // Telegram sends multiple sizes; take the largest.
    const largest = message.photo.reduce((a: TelegramPhotoSize, b: TelegramPhotoSize) =>
      a.width * a.height > b.width * b.height ? a : b
    );
    return {
      fileId: largest.file_id,
      fileUniqueId: largest.file_unique_id,
      filename: `${largest.file_unique_id}.jpg`,
      mimeType: "image/jpeg",
      fileSize: largest.file_size,
    };
  }
  if (message.document) {
    const doc: TelegramDocument = message.document;
    return {
      fileId: doc.file_id,
      fileUniqueId: doc.file_unique_id,
      filename: doc.file_name ?? `${doc.file_unique_id}`,
      mimeType: doc.mime_type ?? guessMimeFromFilename(doc.file_name ?? ""),
      fileSize: doc.file_size,
    };
  }
  return null;
}

/**
 * Handles one incoming photo/document message during an upload session.
 * Supports single images and media-group albums (each message in the
 * group is processed independently and linked via telegramMediaGroupId).
 */
export async function handleIncomingPhotoMessage(
  chatId: number,
  telegramId: string,
  user: User,
  objectId: string,
  message: TelegramMessage
) {
  const incoming = extractIncomingFile(message);
  if (!incoming) {
    await sendMessage(chatId, TXT.unsupportedFileType);
    return;
  }

  const mime = incoming.mimeType;
  if (!isSupportedImageMime(mime)) {
    await sendMessage(chatId, TXT.unsupportedFileType);
    return;
  }

  const maxBytes = MAX_UPLOAD_SIZE_BYTES();
  if (incoming.fileSize && incoming.fileSize > maxBytes) {
    await sendMessage(chatId, TXT.photoTooLarge(Math.round(maxBytes / 1024 / 1024)));
    return;
  }

  // Idempotency: skip if we've already processed this exact Telegram file for this object.
  const existing = await prisma.photo.findFirst({
    where: { objectId, telegramFileUniqueId: incoming.fileUniqueId, deletedAt: null },
  });
  if (existing) {
    await sendMessage(chatId, TXT.duplicateFile);
    return;
  }

  const file = await getFile(incoming.fileId);
  const originalBuffer = await downloadTelegramFile(file.file_path);

  if (originalBuffer.byteLength > maxBytes) {
    await sendMessage(chatId, TXT.photoTooLarge(Math.round(maxBytes / 1024 / 1024)));
    return;
  }

  const checksum = sha256Hex(originalBuffer);
  const duplicateByChecksum = await prisma.photo.findFirst({
    where: { objectId, sha256: checksum, deletedAt: null },
  });
  if (duplicateByChecksum) {
    await sendMessage(chatId, TXT.duplicateFile);
    return;
  }

  const preview = await generatePreview(originalBuffer);
  const dimensions = await readDimensions(originalBuffer);

  const originalKey = buildOriginalKey(objectId, incoming.filename);
  const previewKey = buildPreviewKey(objectId);

  await uploadObject(originalKey, originalBuffer, mime!);
  await uploadObject(previewKey, preview.buffer, preview.contentType);

  const initialComment = message.caption?.trim() || null;

  const photo = await prisma.photo.create({
    data: {
      objectId,
      uploadedById: user.id,
      originalStorageKey: originalKey,
      previewStorageKey: previewKey,
      originalFilename: incoming.filename,
      mimeType: mime!,
      sizeBytes: originalBuffer.byteLength,
      width: dimensions.width ?? preview.width,
      height: dimensions.height ?? preview.height,
      sha256: checksum,
      comment: initialComment,
      telegramFileId: incoming.fileId,
      telegramFileUniqueId: incoming.fileUniqueId,
      telegramMessageId: BigInt(message.message_id),
      telegramMediaGroupId: message.media_group_id ?? null,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "PHOTO_UPLOADED",
    entityType: "Photo",
    entityId: photo.id,
    metadata: { objectId, sizeBytes: photo.sizeBytes },
  });

  const session = await getSession(telegramId);
  const uploadedIds = ((session.temporaryData.uploadedPhotoIds as string[]) ?? []).concat(photo.id);
  await setSession(telegramId, { temporaryData: { ...session.temporaryData, uploadedPhotoIds: uploadedIds } });

  const object = await prisma.constructionObject.findUnique({ where: { id: objectId } });

  if (initialComment) {
    await confirmPhotoSaved(chatId, user, object!.name, photo.uploadedAt, initialComment);
  } else {
    await setSession(telegramId, { state: SessionState.AWAITING_PHOTO_COMMENT, temporaryData: { ...session.temporaryData, uploadedPhotoIds: uploadedIds, pendingCommentPhotoId: photo.id } });
    await sendMessage(chatId, TXT.askComment, {
      inlineKeyboard: [
        [{ text: BTN.skipComment, callback_data: `photo:skip:${photo.id}` }],
        [{ text: BTN.moreImages, callback_data: `photo:more:${objectId}` }, { text: BTN.finish, callback_data: `photo:done:${objectId}` }],
      ],
    });
  }
}

export async function saveCommentForPhoto(chatId: number, telegramId: string, user: User, photoId: string, comment: string) {
  const photo = await prisma.photo.update({ where: { id: photoId }, data: { comment: comment.trim() || null } });
  const object = await prisma.constructionObject.findUnique({ where: { id: photo.objectId } });
  await confirmPhotoSaved(chatId, user, object!.name, photo.uploadedAt, photo.comment);
  await clearCommentStage(telegramId, photo.objectId);
}

export async function skipCommentForPhoto(chatId: number, telegramId: string, user: User, photoId: string) {
  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) return;
  const object = await prisma.constructionObject.findUnique({ where: { id: photo.objectId } });
  await confirmPhotoSaved(chatId, user, object!.name, photo.uploadedAt, null);
  await clearCommentStage(telegramId, photo.objectId);
}

async function clearCommentStage(telegramId: string, objectId: string) {
  await setSession(telegramId, { state: SessionState.AWAITING_PHOTO_UPLOAD, selectedObjectId: objectId });
}

async function confirmPhotoSaved(chatId: number, user: User, objectName: string, uploadedAt: Date, comment: string | null) {
  await sendMessage(
    chatId,
    TXT.photoSaved({
      objectName,
      date: formatDateTashkent(uploadedAt),
      time: formatTimeTashkent(uploadedAt),
      uploader: user.fullName,
      comment: comment && comment.length > 0 ? comment : TXT.noComment,
    })
  );
}

/** Applies one shared comment to every photo uploaded in the current session. */
export async function applyBulkComment(chatId: number, telegramId: string, user: User, objectId: string, comment: string) {
  const session = await getSession(telegramId);
  const ids = (session.temporaryData.uploadedPhotoIds as string[]) ?? [];
  if (ids.length > 0) {
    await prisma.photo.updateMany({ where: { id: { in: ids } }, data: { comment: comment.trim() || null } });
  }
  await finishUploadSession(chatId, telegramId, user, objectId);
}

export async function finishUploadSession(chatId: number, telegramId: string, user: User, objectId: string) {
  await clearSession(telegramId);
  const object = await prisma.constructionObject.findUnique({ where: { id: objectId } });
  await sendMessage(chatId, "✅ Yuklash yakunlandi.", { replyKeyboard: objectMenuKeyboard(can.renameObject(user)) });
  void object;
}

// ---------------- Viewing ----------------

interface PhotoFilter {
  startDate?: Date;
  endDate?: Date;
  uploaderName?: string;
  keyword?: string;
}

export async function viewPhotos(chatId: number, user: User, objectId: string, index = 0, filter: PhotoFilter = {}) {
  const allowed = await assertCanAccessObject(user, objectId);
  if (!allowed) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }

  const where: any = { objectId, deletedAt: null };
  if (filter.startDate || filter.endDate) {
    where.uploadedAt = {};
    if (filter.startDate) where.uploadedAt.gte = filter.startDate;
    if (filter.endDate) where.uploadedAt.lte = filter.endDate;
  }
  if (filter.uploaderName) {
    where.uploadedBy = { fullName: { contains: filter.uploaderName, mode: "insensitive" } };
  }
  if (filter.keyword) {
    where.comment = { contains: filter.keyword, mode: "insensitive" };
  }

  const total = await prisma.photo.count({ where });
  if (total === 0) {
    await sendMessage(chatId, TXT.noPhotosYet);
    return;
  }

  const safeIndex = Math.min(Math.max(index, 0), total - 1);
  const [photo] = await prisma.photo.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
    skip: safeIndex,
    take: 1,
    include: { uploadedBy: true },
  });
  if (!photo) return;

  const previewUrl = await getSignedDownloadUrl(photo.previewStorageKey);
  const caption = TXT.photoCaption({
    index: safeIndex + 1,
    total,
    date: formatDateTashkent(photo.uploadedAt),
    time: formatTimeTashkent(photo.uploadedAt),
    uploader: escapeHtml(photo.uploadedBy.fullName),
    comment: photo.comment ? escapeHtml(photo.comment) : TXT.noComment,
  });

  await sendPhoto(chatId, previewUrl, caption, photoNavigationKeyboard(objectId, safeIndex, total));
}

export async function sendOriginalPhoto(chatId: number, user: User, objectId: string, index: number) {
  const allowed = await assertCanAccessObject(user, objectId);
  if (!allowed) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  const [photo] = await prisma.photo.findMany({
    where: { objectId, deletedAt: null },
    orderBy: { uploadedAt: "desc" },
    skip: index,
    take: 1,
  });
  if (!photo) return;
  const url = await getSignedDownloadUrl(photo.originalStorageKey, photo.originalFilename);
  await sendMessage(chatId, `📥 Original: ${url}`);
}
