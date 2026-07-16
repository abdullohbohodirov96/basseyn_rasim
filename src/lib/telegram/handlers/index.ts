import { getOrBootstrapUser, isActiveUser } from "../../auth";
import { getSession, setSession, clearSession, SessionState } from "../../session";
import { sendMessage, answerCallbackQuery } from "../client";
import { TXT, BTN } from "../text";
import { mainMenuKeyboard } from "../keyboards";
import type { TelegramMessage, TelegramCallbackQuery } from "../types";

import { showMainMenu, showSettings } from "./menu";
import {
  listObjects,
  startCreateObject,
  handleObjectNameInput,
  openObject,
  startRenameObject,
  handleObjectRenameInput,
  askArchiveConfirmation,
  archiveObject,
  restoreObject,
  askDeleteConfirmationStep1,
  askDeleteConfirmationStep2,
  permanentlyDeleteObject,
  viewStaff,
} from "./objects";
import {
  startPhotoUpload,
  handleIncomingPhotoMessage,
  saveCommentForPhoto,
  skipCommentForPhoto,
  applyBulkComment,
  finishUploadSession,
  viewPhotos,
  sendOriginalPhoto,
} from "./photos";
import {
  showUsersMenu,
  listUsers,
  startAddUser,
  handleUserIdInput,
  handleUserFullNameInput,
  setUserRole,
  setUserActive,
  startAssignUserToObject,
  startRemoveUserFromObject,
  handlePickAssignUser,
  handlePickRemoveUser,
  assignUserToObject,
  removeUserFromObject
} from "./users";
import { Role } from "@prisma/client";

export async function handleMessage(message: TelegramMessage) {
  const from = message.from;
  if (!from || from.is_bot) return;
  const telegramId = String(from.id);
  const chatId = message.chat.id;

  const user = await getOrBootstrapUser(telegramId, from.username);
  if (!isActiveUser(user)) {
    await sendMessage(chatId, user === null ? TXT.unauthorized : TXT.inactiveUser);
    return;
  }

  const text = message.text?.trim();

  try {
    if (text === "/start") {
      await clearSession(telegramId);
      // Optional: Clear globally expired sessions here if needed, but typically handled by cron/db.
      await sendMessage(chatId, TXT.welcome(user.fullName), { replyKeyboard: mainMenuKeyboard(user.role) });
      return;
    }

    const session = await getSession(telegramId);

  // Photo / document uploads take priority whenever we're in an upload-capable state.
  if ((message.photo || message.document) && session.selectedObjectId) {
    await handleIncomingPhotoMessage(chatId, telegramId, user, session.selectedObjectId, message);
    return;
  }

  // Global navigation buttons always work, regardless of state.
  if (text === BTN.back) {
    await clearSession(telegramId);
    await showMainMenu(chatId, user);
    return;
  }
  if (text === BTN.objects) {
    await clearSession(telegramId);
    await listObjects(chatId, user, 0, "ACTIVE");
    return;
  }
  if (text === BTN.addObject) {
    await startCreateObject(chatId, telegramId, user);
    return;
  }
  if (text === BTN.archive) {
    await clearSession(telegramId);
    await listObjects(chatId, user, 0, "ARCHIVED");
    return;
  }
  if (text === BTN.settings) {
    await showSettings(chatId, user);
    return;
  }

  // Object-context buttons.
  if (session.selectedObjectId) {
    const objectId = session.selectedObjectId;
    if (text === BTN.addPhoto) {
      await startPhotoUpload(chatId, telegramId, user, objectId);
      return;
    }
    if (text === BTN.viewPhotos) {
      await viewPhotos(chatId, user, objectId, 0);
      return;
    }
    if (text === BTN.rename) {
      await startRenameObject(chatId, telegramId, user, objectId);
      return;
    }
    if (text === BTN.archiveObject) {
      await askArchiveConfirmation(chatId, telegramId, user, objectId);
      return;
    }
    if (text === BTN.permanentlyDelete) {
      await askDeleteConfirmationStep1(chatId, telegramId, user, objectId);
      return;
    }
  }

  // State-driven text input.
  if (text) {
    switch (session.state) {
      case SessionState.AWAITING_OBJECT_NAME:
        await handleObjectNameInput(chatId, telegramId, user, text);
        return;
      case SessionState.AWAITING_OBJECT_RENAME:
        if (session.selectedObjectId) {
          await handleObjectRenameInput(chatId, telegramId, user, session.selectedObjectId, text);
        }
        return;
      case SessionState.AWAITING_PHOTO_COMMENT: {
        const photoId = session.temporaryData.pendingCommentPhotoId as string | undefined;
        if (photoId) await saveCommentForPhoto(chatId, telegramId, user, photoId, text);
        return;
      }
      case SessionState.AWAITING_BULK_COMMENT:
        if (session.selectedObjectId) {
          await applyBulkComment(chatId, telegramId, user, session.selectedObjectId, text);
        }
        return;
      default:
        break;
    }
  }

    await showMainMenu(chatId, user);
  } catch (err) {
    console.error("[handleMessage] error", err);
    try {
      await sendMessage(chatId, "⚠️ Xatolik yuz berdi. Iltimos, /start buyrug‘ini qayta yuboring.");
    } catch {
      // Ignore if sending error message fails
    }
  }
}

export async function handleCallbackQuery(cq: TelegramCallbackQuery) {
  const from = cq.from;
  const telegramId = String(from.id);
  const chatId = cq.message?.chat.id;
  if (!chatId || !cq.data) return;

  const user = await getOrBootstrapUser(telegramId, from.username);
  if (!isActiveUser(user)) {
    await answerCallbackQuery(cq.id, TXT.unauthorized);
    return;
  }
  await answerCallbackQuery(cq.id);

  const [namespace, action, ...rest] = cq.data.split(":");

  if (namespace === "obj") {
    if (action === "open") {
      await openObject(chatId, telegramId, user, rest[0]!);
    } else if (action === "page") {
      await listObjects(chatId, user, Number(rest[0] ?? 0), "ACTIVE");
    } else if (action === "archive") {
      await archiveObject(chatId, telegramId, user, rest[0]!);
    } else if (action === "restore") {
      await restoreObject(chatId, user, rest[0]!);
    } else if (action === "del1") {
      await askDeleteConfirmationStep1(chatId, telegramId, user, rest[0]!);
    } else if (action === "del1confirm") {
      await askDeleteConfirmationStep2(chatId, telegramId, user, rest[0]!);
    } else if (action === "del2") {
      await permanentlyDeleteObject(chatId, telegramId, user, rest[0]!);
    } else if (action === "cancel") {
      await clearSession(telegramId);
      await sendMessage(chatId, TXT.cancelled, { replyKeyboard: mainMenuKeyboard(user.role) });
    }
    return;
  }

  if (namespace === "photo") {
    if (action === "skip") {
      await skipCommentForPhoto(chatId, telegramId, user, rest[0]!);
    } else if (action === "more") {
      await setSession(telegramId, { state: SessionState.AWAITING_PHOTO_UPLOAD, selectedObjectId: rest[0] });
      await sendMessage(chatId, TXT.askPhoto);
    } else if (action === "done") {
      await finishUploadSession(chatId, telegramId, user, rest[0]!);
    } else if (action === "nav") {
      await viewPhotos(chatId, user, rest[0]!, Number(rest[1] ?? 0));
    } else if (action === "download") {
      await sendOriginalPhoto(chatId, user, rest[0]!, Number(rest[1] ?? 0));
    } else if (action === "downloadAll") {
      await sendMessage(chatId, "Barcha original rasmlarni birma-bir emas, umumiy shaklda yuklab olish uchun iltimos, Veb Admin Panelga kiring.");
    } else if (action === "filter") {
      await sendMessage(chatId, "Filtrlash funksiyasidan foydalanish uchun /filter buyrug'ini yuboring yoki admin panelidan foydalaning.");
    }
    return;
  }

  if (namespace === "user") {
    // User management removed for simplicity
    return;
  }
}
