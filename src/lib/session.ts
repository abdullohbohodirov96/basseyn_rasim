import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export const SessionState = {
  IDLE: "IDLE",
  AWAITING_OBJECT_NAME: "AWAITING_OBJECT_NAME",
  AWAITING_OBJECT_RENAME: "AWAITING_OBJECT_RENAME",
  AWAITING_PHOTO_UPLOAD: "AWAITING_PHOTO_UPLOAD",
  AWAITING_PHOTO_COMMENT: "AWAITING_PHOTO_COMMENT",
  AWAITING_BULK_COMMENT: "AWAITING_BULK_COMMENT",
  AWAITING_PHOTO_FILTER: "AWAITING_PHOTO_FILTER",
  AWAITING_USER_TELEGRAM_ID: "AWAITING_USER_TELEGRAM_ID",
  AWAITING_USER_FULL_NAME: "AWAITING_USER_FULL_NAME",
  CONFIRM_ARCHIVE: "CONFIRM_ARCHIVE",
  CONFIRM_DELETE_STEP1: "CONFIRM_DELETE_STEP1",
  CONFIRM_DELETE_STEP2: "CONFIRM_DELETE_STEP2",
} as const;

export type SessionStateType = (typeof SessionState)[keyof typeof SessionState];

const SESSION_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

export interface SessionData {
  state: SessionStateType;
  selectedObjectId: string | null;
  temporaryData: Record<string, unknown>;
}

export async function getSession(telegramId: string): Promise<SessionData> {
  const session = await prisma.botSession.findUnique({ where: { telegramId } });
  if (!session || session.expiresAt < new Date()) {
    return { state: SessionState.IDLE, selectedObjectId: null, temporaryData: {} };
  }
  return {
    state: session.state as SessionStateType,
    selectedObjectId: session.selectedObjectId,
    temporaryData: (session.temporaryData as Record<string, unknown>) ?? {},
  };
}

export async function setSession(
  telegramId: string,
  data: Partial<SessionData>
): Promise<void> {
  const current = await getSession(telegramId);
  const merged: SessionData = {
    state: data.state ?? current.state,
    selectedObjectId:
      data.selectedObjectId !== undefined ? data.selectedObjectId : current.selectedObjectId,
    temporaryData: data.temporaryData ?? current.temporaryData,
  };

  await prisma.botSession.upsert({
    where: { telegramId },
    create: {
      telegramId,
      state: merged.state,
      selectedObjectId: merged.selectedObjectId,
      temporaryData: merged.temporaryData as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
    update: {
      state: merged.state,
      selectedObjectId: merged.selectedObjectId,
      temporaryData: merged.temporaryData as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
}

export async function clearSession(telegramId: string): Promise<void> {
  await setSession(telegramId, {
    state: SessionState.IDLE,
    selectedObjectId: null,
    temporaryData: {},
  });
}
