import { prisma } from "../../prisma";
import { can, seesAllObjects, assertCanAccessObject } from "../../auth";
import { writeAuditLog } from "../../audit";
import { deleteObjects } from "../../r2";
import { setSession, clearSession, SessionState } from "../../session";
import { sendMessage } from "../client";
import { TXT, BTN } from "../text";
import { mainMenuKeyboard, objectMenuKeyboard, objectListKeyboard, confirmKeyboard } from "../keyboards";
import type { InlineKeyboardButton } from "../client";
import type { User, ObjectStatus } from "@prisma/client";

const PAGE_SIZE = 8;

export async function listObjects(chatId: number, user: User, page = 0, status: ObjectStatus = "ACTIVE") {
  const where = seesAllObjects(user)
    ? { status }
    : { status, members: { some: { userId: user.id } } };

  const [total, objects] = await Promise.all([
    prisma.constructionObject.count({ where }),
    prisma.constructionObject.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { photos: { where: { deletedAt: null } } } } },
    }),
  ]);

  if (total === 0) {
    await sendMessage(chatId, status === "ACTIVE" ? TXT.noObjects : "Arxivda obyektlar mavjud emas.");
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = objects.map((o) => ({ id: o.id, name: o.name, photoCount: o._count.photos }));

  await sendMessage(chatId, status === "ACTIVE" ? TXT.objectsListTitle : "🗂 Arxivlangan obyektlar:", {
    inlineKeyboard: objectListKeyboard(rows, page, totalPages),
  });

  if (status === "ARCHIVED" && user.role === "ADMIN") {
    for (const o of objects) {
      const buttons: InlineKeyboardButton[][] = [
        [
          { text: `♻️ ${o.name}`, callback_data: `obj:restore:${o.id}` },
          { text: `🗑 ${o.name}`, callback_data: `obj:del1:${o.id}` },
        ],
      ];
      await sendMessage(chatId, `Amal tanlang: ${o.name}`, { inlineKeyboard: buttons });
    }
  }
}

export async function startCreateObject(chatId: number, telegramId: string, user: User) {
  if (!can.createObject(user)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await setSession(telegramId, { state: SessionState.AWAITING_OBJECT_NAME });
  await sendMessage(chatId, TXT.askObjectName);
}

export async function handleObjectNameInput(chatId: number, telegramId: string, user: User, rawName: string) {
  const name = rawName.trim().replace(/\s{2,}/g, " ");
  if (name.length < 2) {
    await sendMessage(chatId, TXT.objectNameTooShort);
    return;
  }
  if (name.length > 150) {
    await sendMessage(chatId, TXT.objectNameTooLong);
    return;
  }

  const created = await prisma.constructionObject.create({
    data: { name, createdById: user.id, status: "ACTIVE" },
  });

  await prisma.objectMember.create({
    data: { objectId: created.id, userId: user.id, permission: "MANAGE" },
  });

  await writeAuditLog({
    userId: user.id,
    action: "OBJECT_CREATED",
    entityType: "ConstructionObject",
    entityId: created.id,
    metadata: { name },
  });

  await clearSession(telegramId);
  await sendMessage(chatId, TXT.objectCreated, { replyKeyboard: mainMenuKeyboard(user.role) });
  await sendMessage(chatId, created.name, {
    replyKeyboard: objectMenuKeyboard(user.role),
  });
  await setSession(telegramId, { selectedObjectId: created.id, state: "IDLE" as any });
}

export async function openObject(chatId: number, telegramId: string, user: User, objectId: string) {
  const allowed = await assertCanAccessObject(user, objectId);
  if (!allowed) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  const object = await prisma.constructionObject.findUnique({ where: { id: objectId } });
  if (!object) {
    await sendMessage(chatId, TXT.genericError);
    return;
  }
  await setSession(telegramId, { selectedObjectId: objectId, state: "IDLE" as any });
  await sendMessage(chatId, `🏗 ${object.name}`, { replyKeyboard: objectMenuKeyboard(user.role) });
}

export async function startRenameObject(chatId: number, telegramId: string, user: User, objectId: string) {
  if (!can.renameObject(user)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await setSession(telegramId, { state: SessionState.AWAITING_OBJECT_RENAME, selectedObjectId: objectId });
  await sendMessage(chatId, TXT.askObjectRename);
}

export async function handleObjectRenameInput(chatId: number, telegramId: string, user: User, objectId: string, rawName: string) {
  const name = rawName.trim().replace(/\s{2,}/g, " ");
  if (name.length < 2 || name.length > 150) {
    await sendMessage(chatId, name.length < 2 ? TXT.objectNameTooShort : TXT.objectNameTooLong);
    return;
  }
  await prisma.constructionObject.update({ where: { id: objectId }, data: { name } });
  await writeAuditLog({ userId: user.id, action: "OBJECT_RENAMED", entityType: "ConstructionObject", entityId: objectId, metadata: { name } });
  await clearSession(telegramId);
  await sendMessage(chatId, TXT.objectRenamed, { replyKeyboard: mainMenuKeyboard(user.role) });
}

export async function askArchiveConfirmation(chatId: number, telegramId: string, user: User, objectId: string) {
  if (!can.archiveObject(user)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await setSession(telegramId, { state: SessionState.CONFIRM_ARCHIVE, selectedObjectId: objectId });
  await sendMessage(chatId, TXT.archiveConfirm, {
    inlineKeyboard: confirmKeyboard(BTN.confirmArchive, `obj:archive:${objectId}`, `obj:cancel:${objectId}`),
  });
}

export async function archiveObject(chatId: number, telegramId: string, user: User, objectId: string) {
  if (!can.archiveObject(user)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await prisma.constructionObject.update({
    where: { id: objectId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  await writeAuditLog({ userId: user.id, action: "OBJECT_ARCHIVED", entityType: "ConstructionObject", entityId: objectId });
  await clearSession(telegramId);
  await sendMessage(chatId, TXT.archived, { replyKeyboard: mainMenuKeyboard(user.role) });
}

export async function restoreObject(chatId: number, user: User, objectId: string) {
  if (!can.restoreObject(user)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await prisma.constructionObject.update({
    where: { id: objectId },
    data: { status: "ACTIVE", archivedAt: null },
  });
  await writeAuditLog({ userId: user.id, action: "OBJECT_RESTORED", entityType: "ConstructionObject", entityId: objectId });
  await sendMessage(chatId, TXT.restored, { replyKeyboard: mainMenuKeyboard(user.role) });
}

export async function askDeleteConfirmationStep1(chatId: number, telegramId: string, user: User, objectId: string) {
  if (!can.permanentlyDeleteObject(user)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await setSession(telegramId, { state: SessionState.CONFIRM_DELETE_STEP1, selectedObjectId: objectId });
  await sendMessage(chatId, TXT.deleteConfirm1, {
    inlineKeyboard: confirmKeyboard("Davom etish", `obj:del1confirm:${objectId}`, `obj:cancel:${objectId}`),
  });
}

export async function askDeleteConfirmationStep2(chatId: number, telegramId: string, user: User, objectId: string) {
  if (!can.permanentlyDeleteObject(user)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await setSession(telegramId, { state: SessionState.CONFIRM_DELETE_STEP2, selectedObjectId: objectId });
  await sendMessage(chatId, TXT.deleteConfirm2, {
    inlineKeyboard: confirmKeyboard(BTN.permanentlyDelete, `obj:del2:${objectId}`, `obj:cancel:${objectId}`),
  });
}

/** Permanently deletes an object: DB transaction + R2 object cleanup + audit log. */
export async function permanentlyDeleteObject(chatId: number, telegramId: string, user: User, objectId: string) {
  if (!can.permanentlyDeleteObject(user)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }

  const object = await prisma.constructionObject.findUnique({
    where: { id: objectId },
    include: { photos: true },
  });
  if (!object) {
    await sendMessage(chatId, TXT.genericError);
    return;
  }

  // Audit log BEFORE deletion, as required.
  await writeAuditLog({
    userId: user.id,
    action: "OBJECT_PERMANENTLY_DELETED",
    entityType: "ConstructionObject",
    entityId: objectId,
    metadata: { name: object.name, photoCount: object.photos.length },
  });

  const storageKeys = object.photos.flatMap((p) => [p.originalStorageKey, p.previewStorageKey]);

  await prisma.$transaction([
    prisma.photo.deleteMany({ where: { objectId } }),
    prisma.objectMember.deleteMany({ where: { objectId } }),
    prisma.constructionObject.delete({ where: { id: objectId } }),
  ]);

  // Storage cleanup happens after the DB transaction succeeds so we never
  // leave the DB in a state that references deleted files, and vice versa
  // a failed storage cleanup does not roll back the DB delete (best-effort,
  // logged for manual follow-up).
  try {
    await deleteObjects(storageKeys);
  } catch (err) {
    console.error("[permanentlyDeleteObject] R2 cleanup failed", { objectId, error: (err as Error).message });
  }

  await clearSession(telegramId);
  await sendMessage(chatId, TXT.deleted, { replyKeyboard: mainMenuKeyboard(user.role) });
}

export async function viewStaff(chatId: number, user: User, objectId: string) {
  const object = await prisma.constructionObject.findUnique({
    where: { id: objectId },
    include: { members: { include: { user: true } } },
  });
  if (!object) return;
  const staff = object.members.map(m => `👤 ${m.user.fullName} (${m.user.role})`).join("\n");
  await sendMessage(chatId, staff || "Hech qanday xodim biriktirilmagan.");
}
