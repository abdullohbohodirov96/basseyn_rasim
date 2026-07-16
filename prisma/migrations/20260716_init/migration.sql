-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'WORKER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ObjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ObjectPermission" AS ENUM ('VIEW', 'UPLOAD', 'MANAGE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_objects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ObjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "construction_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_members" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "ObjectPermission" NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "object_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalStorageKey" TEXT NOT NULL,
    "previewStorageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT NOT NULL,
    "comment" TEXT,
    "telegramFileId" TEXT NOT NULL,
    "telegramFileUniqueId" TEXT NOT NULL,
    "telegramMessageId" BIGINT NOT NULL,
    "telegramMediaGroupId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_sessions" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "selectedObjectId" TEXT,
    "temporaryData" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_telegram_updates" (
    "id" TEXT NOT NULL,
    "updateId" BIGINT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_telegram_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");

-- CreateIndex
CREATE INDEX "users_telegramId_idx" ON "users"("telegramId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "construction_objects_status_idx" ON "construction_objects"("status");

-- CreateIndex
CREATE INDEX "construction_objects_archivedAt_idx" ON "construction_objects"("archivedAt");

-- CreateIndex
CREATE INDEX "object_members_userId_idx" ON "object_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "object_members_objectId_userId_key" ON "object_members"("objectId", "userId");

-- CreateIndex
CREATE INDEX "photos_objectId_uploadedAt_idx" ON "photos"("objectId", "uploadedAt");

-- CreateIndex
CREATE INDEX "photos_uploadedById_idx" ON "photos"("uploadedById");

-- CreateIndex
CREATE INDEX "photos_telegramMediaGroupId_idx" ON "photos"("telegramMediaGroupId");

-- CreateIndex
CREATE INDEX "photos_sha256_idx" ON "photos"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "bot_sessions_telegramId_key" ON "bot_sessions"("telegramId");

-- CreateIndex
CREATE INDEX "bot_sessions_telegramId_idx" ON "bot_sessions"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "processed_telegram_updates_updateId_key" ON "processed_telegram_updates"("updateId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "construction_objects" ADD CONSTRAINT "construction_objects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_members" ADD CONSTRAINT "object_members_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_members" ADD CONSTRAINT "object_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

