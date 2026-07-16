import { prisma } from "../../prisma";
import { can } from "../../auth";
import { writeAuditLog } from "../../audit";
import { setSession, getSession, clearSession, SessionState } from "../../session";
import { sendMessage } from "../client";
import { TXT } from "../text";
import { Role } from "@prisma/client";
import type { User } from "@prisma/client";
import type { TelegramMessage } from "../types";

export async function startAddUser(chatId: number, telegramId: string, actor: User) {
  if (!can.manageUsers(actor)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await setSession(telegramId, { state: SessionState.AWAITING_USER_TELEGRAM_ID, temporaryData: {} });
  await sendMessage(chatId, TXT.askUserTelegramId);
}

/** Accepts either a typed Telegram ID or a forwarded message (extracts forward_from). */
export async function handleUserIdInput(chatId: number, telegramId: string, actor: User, message: TelegramMessage) {
  let targetTelegramId: string | null = null;
  let username: string | undefined;

  if (message.forward_from) {
    targetTelegramId = String(message.forward_from.id);
    username = message.forward_from.username;
  } else if (message.text && /^\d+$/.test(message.text.trim())) {
    targetTelegramId = message.text.trim();
  }

  if (!targetTelegramId) {
    await sendMessage(chatId, "❌ Telegram ID noto'g'ri. Faqat raqam yuboring yoki xabarni forward qiling.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { telegramId: targetTelegramId } });
  if (existing) {
    await sendMessage(chatId, TXT.userAlreadyExists);
    await clearSession(telegramId);
    return;
  }

  await setSession(telegramId, {
    state: SessionState.AWAITING_USER_FULL_NAME,
    temporaryData: { targetTelegramId, username },
  });
  await sendMessage(chatId, TXT.askUserFullName);
}

export async function handleUserFullNameInput(chatId: number, telegramId: string, actor: User, fullName: string) {
  const session = await getSession(telegramId);
  const targetTelegramId = session.temporaryData.targetTelegramId as string | undefined;
  const username = session.temporaryData.username as string | undefined;
  if (!targetTelegramId) {
    await sendMessage(chatId, TXT.genericError);
    await clearSession(telegramId);
    return;
  }

  const user = await prisma.user.create({
    data: {
      telegramId: targetTelegramId,
      username,
      fullName: fullName.trim().slice(0, 200) || "Foydalanuvchi",
      role: Role.VIEWER,
      isActive: true,
    },
  });

  await writeAuditLog({
    userId: actor.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    metadata: { telegramId: targetTelegramId, fullName: user.fullName },
  });

  await clearSession(telegramId);
  await sendMessage(chatId, `${TXT.userAdded}\n\n${user.fullName} — rol: ${user.role}`);
}

export async function setUserRole(chatId: number, actor: User, targetUserId: string, role: Role) {
  if (!can.manageUsers(actor)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  const user = await prisma.user.update({ where: { id: targetUserId }, data: { role } });
  await writeAuditLog({ userId: actor.id, action: "USER_ROLE_CHANGED", entityType: "User", entityId: user.id, metadata: { role } });
  await sendMessage(chatId, TXT.roleChanged);
}

export async function setUserActive(chatId: number, actor: User, targetUserId: string, isActive: boolean) {
  if (!can.manageUsers(actor)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  const user = await prisma.user.update({ where: { id: targetUserId }, data: { isActive } });
  await writeAuditLog({
    userId: actor.id,
    action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    entityType: "User",
    entityId: user.id,
  });
  await sendMessage(chatId, isActive ? TXT.userActivated : TXT.userDeactivated);
}

export async function assignUserToObject(chatId: number, actor: User, targetUserId: string, objectId: string) {
  if (!can.manageUsers(actor) && !can.renameObject(actor)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await prisma.objectMember.upsert({
    where: { objectId_userId: { objectId, userId: targetUserId } },
    create: { objectId, userId: targetUserId, permission: "UPLOAD" },
    update: {},
  });
  await writeAuditLog({ userId: actor.id, action: "USER_ASSIGNED_TO_OBJECT", entityType: "ObjectMember", entityId: objectId, metadata: { targetUserId } });
  await sendMessage(chatId, "✅ Foydalanuvchi obyektga biriktirildi.");
}

export async function removeUserFromObject(chatId: number, actor: User, targetUserId: string, objectId: string) {
  if (!can.manageUsers(actor) && !can.renameObject(actor)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await prisma.objectMember.deleteMany({ where: { objectId, userId: targetUserId } });
  await writeAuditLog({ userId: actor.id, action: "USER_REMOVED_FROM_OBJECT", entityType: "ObjectMember", entityId: objectId, metadata: { targetUserId } });
  await sendMessage(chatId, "✅ Foydalanuvchi obyektdan olib tashlandi.");
}
