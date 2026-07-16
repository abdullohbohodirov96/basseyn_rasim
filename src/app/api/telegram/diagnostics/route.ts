import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getWebhookInfo } from "@/lib/telegram/client";
import { prisma } from "@/lib/prisma";
import { isR2Configured, checkR2Connection } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let env;
  try {
    env = getEnv();
  } catch {
    return NextResponse.json({ ok: false, error: "Environment missing" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result: any = {
    ok: true,
    telegramToken: "valid",
    webhookUrl: "correct",
    webhookLastError: null,
    database: "connected",
    requiredTables: "available",
    initialAdminConfigured: false,
    r2: "configured"
  };

  try {
    const info: any = await getWebhookInfo();
    const expectedUrl = `${env.APP_URL.replace(/\/$/, "")}/api/telegram/webhook`;
    if (info.url !== expectedUrl) result.webhookUrl = "incorrect";
    if (info.last_error_message) result.webhookLastError = info.last_error_message;
  } catch {
    result.telegramToken = "invalid";
    result.webhookUrl = "unknown";
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    result.database = "disconnected";
  }

  try {
    await prisma.processedTelegramUpdate.findFirst();
  } catch {
    result.requiredTables = "missing";
  }

  try {
    if (env.INITIAL_ADMIN_TELEGRAM_ID) {
      result.initialAdminConfigured = true;
    }
  } catch {
    // 
  }

  try {
    if (isR2Configured()) {
      const ok = await checkR2Connection();
      result.r2 = ok ? "configured" : "error";
    } else {
      result.r2 = "not_configured";
    }
  } catch {
    result.r2 = "error";
  }

  return NextResponse.json(result);
}
