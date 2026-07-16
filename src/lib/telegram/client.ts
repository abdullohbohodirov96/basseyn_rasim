import { getEnv } from "../env";
import { retry } from "../utils";

const TELEGRAM_API_BASE = "https://api.telegram.org";

function apiUrl(method: string): string {
  const env = getEnv();
  return `${TELEGRAM_API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
}

function fileUrl(filePath: string): string {
  const env = getEnv();
  return `${TELEGRAM_API_BASE}/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
}

async function callTelegram<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T> {
  return retry(
    async () => {
      const res = await fetch(apiUrl(method), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(`Telegram API error (${method}): ${json.description ?? res.statusText}`);
      }
      return json.result as T;
    },
    { attempts: 3, delayMs: 400 }
  );
}

export interface ReplyKeyboardButton {
  text: string;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export function sendMessage(
  chatId: string | number,
  text: string,
  options: {
    replyKeyboard?: ReplyKeyboardButton[][];
    inlineKeyboard?: InlineKeyboardButton[][];
    removeKeyboard?: boolean;
    parseMode?: "HTML";
  } = {}
) {
  const reply_markup = options.inlineKeyboard
    ? { inline_keyboard: options.inlineKeyboard }
    : options.replyKeyboard
      ? { keyboard: options.replyKeyboard, resize_keyboard: true }
      : options.removeKeyboard
        ? { remove_keyboard: true }
        : undefined;

  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: options.parseMode,
    reply_markup,
  });
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export function sendPhoto(
  chatId: string | number,
  photoUrlOrFileId: string,
  caption?: string,
  inlineKeyboard?: InlineKeyboardButton[][]
) {
  return callTelegram("sendPhoto", {
    chat_id: chatId,
    photo: photoUrlOrFileId,
    caption,
    parse_mode: "HTML",
    reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined,
  });
}

export function sendMediaGroup(
  chatId: string | number,
  items: { type: "photo"; media: string; caption?: string; parse_mode?: "HTML" }[]
) {
  return callTelegram("sendMediaGroup", { chat_id: chatId, media: items });
}

export function sendDocument(chatId: string | number, url: string, caption?: string) {
  return callTelegram("sendDocument", { chat_id: chatId, document: url, caption });
}

export async function getFile(fileId: string): Promise<{ file_path: string; file_size?: number }> {
  return callTelegram("getFile", { file_id: fileId });
}

export async function downloadTelegramFile(filePath: string): Promise<Buffer> {
  const res = await fetch(fileUrl(filePath), { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Failed to download Telegram file: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function setWebhook(url: string, secretToken: string) {
  return callTelegram("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
    max_connections: 40,
  });
}

export function deleteWebhook() {
  return callTelegram("deleteWebhook", {});
}

export function getWebhookInfo() {
  return callTelegram("getWebhookInfo", {});
}

export function getMe(): Promise<any> {
  return callTelegram("getMe", {});
}
