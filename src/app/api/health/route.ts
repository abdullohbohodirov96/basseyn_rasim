import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkR2Connection, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_VERSION = process.env.npm_package_version ?? "1.0.0";

export async function GET() {
  const startedAt = Date.now();

  let dbStatus: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }

  let storageStatus: "ok" | "not_configured" | "error" = "not_configured";
  if (isR2Configured()) {
    storageStatus = (await checkR2Connection()) ? "ok" : "error";
  }

  const overallOk = dbStatus === "ok" && storageStatus === "ok";

  return NextResponse.json(
    {
      status: overallOk ? "ok" : "degraded",
      version: APP_VERSION,
      database: dbStatus,
      storage: storageStatus,
      timeZone: "Asia/Tashkent",
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: overallOk ? 200 : 503 }
  );
}
