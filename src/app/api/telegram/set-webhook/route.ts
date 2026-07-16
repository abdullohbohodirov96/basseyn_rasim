import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { setWebhook, getWebhookInfo } from "@/lib/telegram/client";

export const runtime = "nodejs";

/**
 * Protected by CRON_SECRET (reused here as a generic "admin operations"
 * secret) via the Authorization header: `Bearer <CRON_SECRET>`.
 *
 * Usage:
 *   curl -X POST https://<your-app>.vercel.app/api/telegram/set-webhook \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(req: NextRequest) {
  const env = getEnv();
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!env.APP_URL) {
    return NextResponse.json({ ok: false, error: "APP_URL is not set" }, { status: 400 });
  }

  const url = `${env.APP_URL.replace(/\/$/, "")}/api/telegram/webhook`;
  const result = await setWebhook(url, env.TELEGRAM_WEBHOOK_SECRET);
  return NextResponse.json({ ok: true, url, result });
}

export async function GET(req: NextRequest) {
  const env = getEnv();
  const searchParams = req.nextUrl.searchParams;
  const secretParam = searchParams.get("secret");
  const auth = req.headers.get("authorization");
  
  if (secretParam !== env.CRON_SECRET && auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const action = searchParams.get("action");
  if (action === "set") {
    if (!env.APP_URL) {
      return NextResponse.json({ ok: false, error: "APP_URL is not set" }, { status: 400 });
    }
    const url = `${env.APP_URL.replace(/\/$/, "")}/api/telegram/webhook`;
    const result = await setWebhook(url, env.TELEGRAM_WEBHOOK_SECRET);
    return NextResponse.json({ ok: true, url, result });
  }

  const info = await getWebhookInfo();
  return NextResponse.json({ ok: true, info });
}
