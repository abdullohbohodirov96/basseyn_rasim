import { sendMessage } from "../client";
import { TXT } from "../text";
import { mainMenuKeyboard } from "../keyboards";
import type { User } from "@prisma/client";

export async function showMainMenu(chatId: number, user: User) {
  await sendMessage(chatId, TXT.mainMenuPrompt, { replyKeyboard: mainMenuKeyboard(user.role) });
}

export async function showSettings(chatId: number, user: User) {
  await sendMessage(chatId, `${TXT.settingsMenu}\n\n${TXT.yourRole(user.role)}`);
}
