import { NextRequest, NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { handleMessage, handleCallbackQuery } from "@/lib/telegram/handlers";
import type { TelegramUpdate } from "@/lib/telegram/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // 1. Verify Telegram's webhook secret header before doing any work.
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  let env;
  try {
    env = getEnv();
  } catch (err) {
    console.error("[webhook] env misconfigured", (err as Error).message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  if (secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "invalid secret" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // 2. Respond 200 fast; process the update, guarding against duplicates.
  try {
    const isNew = await markUpdateProcessed(update.update_id);
    if (!isNew) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (update.message) {
      after(async () => {
        try {
          await handleMessage(update.message!);
        } catch (err) {
          console.error("[webhook] handler error", { updateId: update.update_id, error: (err as Error).message });
        }
      });
    } else if (update.callback_query) {
      after(async () => {
        try {
          await handleCallbackQuery(update.callback_query!);
        } catch (err) {
          console.error("[webhook] handler error", { updateId: update.update_id, error: (err as Error).message });
        }
      });
    }
  } catch (err) {
    let code = "UNKNOWN";
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      code = err.code;
    }
    console.error("[webhook] error", {
      updateId: update.update_id,
      errorName: (err as Error).name,
      prismaCode: code,
      errorMessage: (err as Error).message,
    });
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function markUpdateProcessed(updateId: number): Promise<boolean> {
  try {
    await prisma.processedTelegramUpdate.create({ data: { updateId: BigInt(updateId) } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false; // Unique constraint violation => already processed.
    }
    throw error;
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Telegram webhook endpoint. Use POST." });
}
