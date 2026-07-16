import { Role } from "@prisma/client";
import { BTN } from "./text";
import type { ReplyKeyboardButton, InlineKeyboardButton } from "./client";

export function mainMenuKeyboard(role: Role): ReplyKeyboardButton[][] {
  const rows: ReplyKeyboardButton[][] = [
    [{ text: BTN.objects }, { text: BTN.addObject }],
    [{ text: BTN.archive }],
  ];
  if (role === Role.ADMIN) {
    rows[1]!.push({ text: BTN.users });
  }
  rows.push([{ text: BTN.settings }]);
  return rows;
}

export function objectMenuKeyboard(role: Role): ReplyKeyboardButton[][] {
  const rows: ReplyKeyboardButton[][] = [
    [{ text: BTN.addPhoto }, { text: BTN.viewPhotos }],
    [{ text: BTN.viewStaff }, { text: BTN.rename }],
    [{ text: BTN.archiveObject }],
  ];
  if (role === Role.ADMIN) {
    rows.push([{ text: BTN.permanentlyDelete }]);
  }
  rows.push([{ text: BTN.back }]);
  return rows;
}

export function usersMenuKeyboard(): ReplyKeyboardButton[][] {
  return [
    [{ text: BTN.addUser }, { text: BTN.usersList }],
    [{ text: BTN.assignUserToObject }, { text: BTN.removeUser }],
    [{ text: BTN.back }],
  ];
}

export function rolesKeyboard(userId: string): InlineKeyboardButton[][] {
  return [
    [
      { text: "ADMIN", callback_data: `user:role:${userId}:ADMIN` },
      { text: "MANAGER", callback_data: `user:role:${userId}:MANAGER` },
    ],
    [
      { text: "WORKER", callback_data: `user:role:${userId}:WORKER` },
      { text: "VIEWER", callback_data: `user:role:${userId}:VIEWER` },
    ],
  ];
}

export function confirmKeyboard(confirmText: string, confirmData: string, cancelData: string): InlineKeyboardButton[][] {
  return [
    [
      { text: confirmText, callback_data: confirmData },
      { text: BTN.cancel, callback_data: cancelData },
    ],
  ];
}

export function paginationKeyboard(
  page: number,
  totalPages: number,
  prefix: string
): InlineKeyboardButton[][] {
  const row: InlineKeyboardButton[] = [];
  if (page > 0) row.push({ text: BTN.prevPage, callback_data: `${prefix}:${page - 1}` });
  if (page < totalPages - 1) row.push({ text: BTN.nextPage, callback_data: `${prefix}:${page + 1}` });
  return row.length ? [row] : [];
}

export function objectListKeyboard(
  objects: { id: string; name: string; photoCount: number }[],
  page: number,
  totalPages: number
): InlineKeyboardButton[][] {
  const rows: InlineKeyboardButton[][] = objects.map((o) => [
    { text: `${o.name} — ${o.photoCount} ta rasm`, callback_data: `obj:open:${o.id}` },
  ]);
  const pagination = paginationKeyboard(page, totalPages, "obj:page");
  return [...rows, ...pagination];
}

export function photoNavigationKeyboard(objectId: string, index: number, total: number): InlineKeyboardButton[][] {
  const nav: InlineKeyboardButton[] = [];
  if (index > 0) nav.push({ text: BTN.prevPage.replace("Oldingi", "Oldingi"), callback_data: `photo:nav:${objectId}:${index - 1}` });
  if (index < total - 1) nav.push({ text: BTN.nextPage, callback_data: `photo:nav:${objectId}:${index + 1}` });
  return [
    nav,
    [{ text: BTN.downloadOriginal, callback_data: `photo:download:${objectId}:${index}` }],
    [{ text: BTN.filter, callback_data: `photo:filter:${objectId}` }],
  ].filter((r) => r.length > 0);
}
