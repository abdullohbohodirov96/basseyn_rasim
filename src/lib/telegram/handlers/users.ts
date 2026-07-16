import { prisma } from "../../prisma";
import { can } from "../../auth";
import { writeAuditLog } from "../../audit";
import { setSession, getSession, clearSession, SessionState } from "../../session";
import { sendMessage } from "../client";
import { TXT, BTN } from "../text";
import { usersMenuKeyboard, rolesKeyboard, paginationKeyboard } from "../keyboards";
import { Role } from "@prisma/client";
import type { User } from "@prisma/client";
import type { TelegramMessage } from "../types";
import type { InlineKeyboardButton } from "../client";

export async function showUsersMenu(chatId: number, user: User) {
  if (!can.manageUsers(user)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await sendMessage(chatId, TXT.usersMenu, { replyKeyboard: usersMenuKeyboard() });
}

export async function listUsers(chatId: number, user: User, page = 0) {
  if (!can.manageUsers(user)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  const PAGE_SIZE = 10;
  const total = await prisma.user.count();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  
  for (const u of users) {
    const status = u.isActive ? "✅ Faol" : "🚫 O'chirilgan";
    const text = `👤 ${u.fullName}\n🆔 ${u.telegramId}\n🎭 Rol: ${u.role}\n holat: ${status}`;
    const keyboard: InlineKeyboardButton[][] = [
      ...rolesKeyboard(u.id),
      [
        { text: u.isActive ? "🚫 Faolsizlantirish" : "✅ Faollashtirish", callback_data: `user:active:${u.id}:${!u.isActive}` }
      ]
    ];
    await sendMessage(chatId, text, { inlineKeyboard: keyboard });
  }

  const pagination = paginationKeyboard(page, totalPages, "user:page");
  if (pagination.length > 0) {
    await sendMessage(chatId, `Sahifa ${page + 1} / ${totalPages}`, { inlineKeyboard: pagination });
  }
}

export async function startAddUser(chatId: number, telegramId: string, actor: User) {
  if (!can.manageUsers(actor)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await setSession(telegramId, { state: SessionState.AWAITING_USER_TELEGRAM_ID, temporaryData: {} });
  await sendMessage(chatId, TXT.askUserTelegramId);
}

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

// Assignment logic starts here:

export async function startAssignUserToObject(chatId: number, telegramId: string, actor: User) {
  if (!can.manageUsers(actor)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  const users = await prisma.user.findMany({ where: { isActive: true } });
  if (!users.length) return;
  
  const keyboard: InlineKeyboardButton[][] = users.map(u => ([
    { text: u.fullName, callback_data: `user:pickassign:${u.id}` }
  ]));
  
  await sendMessage(chatId, "Qaysi foydalanuvchini obyektga biriktirmoqchisiz?", { inlineKeyboard: keyboard });
}

export async function handlePickAssignUser(chatId: number, telegramId: string, actor: User, targetUserId: string) {
  if (!can.manageUsers(actor)) return;
  const objects = await prisma.constructionObject.findMany({ where: { status: "ACTIVE" } });
  const keyboard: InlineKeyboardButton[][] = objects.map(o => ([
    { text: o.name, callback_data: `user:doassign:${targetUserId}:${o.id}` }
  ]));
  await sendMessage(chatId, "Qaysi obyektga biriktirmoqchisiz?", { inlineKeyboard: keyboard });
}

export async function startRemoveUserFromObject(chatId: number, telegramId: string, actor: User) {
  if (!can.manageUsers(actor)) return;
  const users = await prisma.user.findMany({ where: { isActive: true } });
  const keyboard: InlineKeyboardButton[][] = users.map(u => ([
    { text: u.fullName, callback_data: `user:pickremove:${u.id}` }
  ]));
  await sendMessage(chatId, "Qaysi foydalanuvchini obyektdan olib tashlamoqchisiz?", { inlineKeyboard: keyboard });
}

export async function handlePickRemoveUser(chatId: number, telegramId: string, actor: User, targetUserId: string) {
  if (!can.manageUsers(actor)) return;
  const memberLinks = await prisma.objectMember.findMany({
    where: { userId: targetUserId },
    include: { object: true }
  });
  if (!memberLinks.length) {
    await sendMessage(chatId, "Bu foydalanuvchi hech qanday obyektga biriktirilmagan.");
    return;
  }
  const keyboard: InlineKeyboardButton[][] = memberLinks.map(m => ([
    { text: m.object.name, callback_data: `user:doremove:${targetUserId}:${m.objectId}` }
  ]));
  await sendMessage(chatId, "Qaysi obyektdan olib tashlamoqchisiz?", { inlineKeyboard: keyboard });
}

export async function assignUserToObject(chatId: number, actor: User, targetUserId: string, objectId: string) {
  if (!can.manageUsers(actor)) {
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
  if (!can.manageUsers(actor)) {
    await sendMessage(chatId, TXT.unauthorized);
    return;
  }
  await prisma.objectMember.deleteMany({ where: { objectId, userId: targetUserId } });
  await writeAuditLog({ userId: actor.id, action: "USER_REMOVED_FROM_OBJECT", entityType: "ObjectMember", entityId: objectId, metadata: { targetUserId } });
  await sendMessage(chatId, "✅ Foydalanuvchi obyektdan olib tashlandi.");
}
