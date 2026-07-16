import { NextRequest, NextResponse } from "next/server";
import { gzipSync } from "zlib";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { uploadObject } from "@/lib/r2";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(req: NextRequest): boolean {
  const env = getEnv();
  const header = req.headers.get("authorization");
  if (header === `Bearer ${env.CRON_SECRET}`) return true;
  // Vercel Cron also allows verifying via this convention.
  const cronHeader = req.headers.get("x-vercel-cron-secret");
  return cronHeader === env.CRON_SECRET;
}

async function runBackup() {
  const [users, objects, members, photos] = await Promise.all([
    prisma.user.findMany(),
    prisma.constructionObject.findMany(),
    prisma.objectMember.findMany(),
    prisma.photo.findMany({ where: { deletedAt: null } }),
  ]);

  const generatedAt = new Date();
  const payload = {
    manifest: {
      generatedAt: generatedAt.toISOString(),
      counts: {
        users: users.length,
        objects: objects.length,
        members: members.length,
        photos: photos.length,
      },
      notice:
        "This backup contains database metadata only. Original image binaries remain in Cloudflare R2 and are never deleted by this job.",
    },
    users,
    objects,
    members,
    photos,
  };

  const json = JSON.stringify(
    payload,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
  const gz = gzipSync(Buffer.from(json, "utf-8"));

  const year = generatedAt.getUTCFullYear();
  const month = String(generatedAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(generatedAt.getUTCDate()).padStart(2, "0");
  const timestamp = generatedAt.toISOString().replace(/[:.]/g, "-");
  const key = `backups/${year}/${month}/${day}/database-${timestamp}.json.gz`;

  await uploadObject(key, gz, "application/gzip");

  await writeAuditLog({
    action: "BACKUP_CREATED",
    entityType: "Backup",
    entityId: key,
    metadata: payload.manifest.counts,
  });

  return { key, ...payload.manifest };
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runBackup();
    return NextResponse.json({ ok: true, backup: result });
  } catch (err) {
    console.error("[backup] failed", (err as Error).message);
    return NextResponse.json({ ok: false, error: "backup failed" }, { status: 500 });
  }
}

// Vercel Cron sends GET requests by default.
export async function GET(req: NextRequest) {
  return POST(req);
}
