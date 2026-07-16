"use server";

import { redirect } from "next/navigation";
import { verifyAdminCredentials, createAdminSession, destroyAdminSession } from "@/lib/admin-auth";
import { isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { Role } from "@prisma/client";
import { headers } from "next/headers";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(`admin-login:${ip}`, 5, 60_000)) {
    redirect("/admin/login?error=rate_limited");
  }

  if (!verifyAdminCredentials(username, password)) {
    redirect("/admin/login?error=invalid");
  }

  await createAdminSession(username);
  redirect("/admin");
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}

export async function archiveObjectAction(objectId: string) {
  await prisma.constructionObject.update({ where: { id: objectId }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  await writeAuditLog({ action: "OBJECT_ARCHIVED", entityType: "ConstructionObject", entityId: objectId, metadata: { via: "admin_panel" } });
  redirect(`/admin/objects/${objectId}`);
}

export async function restoreObjectAction(objectId: string) {
  await prisma.constructionObject.update({ where: { id: objectId }, data: { status: "ACTIVE", archivedAt: null } });
  await writeAuditLog({ action: "OBJECT_RESTORED", entityType: "ConstructionObject", entityId: objectId, metadata: { via: "admin_panel" } });
  redirect(`/admin/objects/${objectId}`);
}

export async function updatePhotoCommentAction(photoId: string, objectId: string, formData: FormData) {
  const comment = String(formData.get("comment") ?? "");
  await prisma.photo.update({ where: { id: photoId }, data: { comment: comment.trim() || null } });
  await writeAuditLog({ action: "PHOTO_COMMENT_EDITED", entityType: "Photo", entityId: photoId, metadata: { via: "admin_panel" } });
  redirect(`/admin/objects/${objectId}`);
}

export async function setUserRoleAction(userId: string, role: string) {
  if (!Object.values(Role).includes(role as Role)) return;
  await prisma.user.update({ where: { id: userId }, data: { role: role as Role } });
  await writeAuditLog({ action: "USER_ROLE_CHANGED", entityType: "User", entityId: userId, metadata: { role, via: "admin_panel" } });
  redirect("/admin/users");
}

export async function toggleUserActiveAction(userId: string, isActive: boolean) {
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  await writeAuditLog({
    action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    entityType: "User",
    entityId: userId,
    metadata: { via: "admin_panel" },
  });
  redirect("/admin/users");
}

export async function assignUserToObjectAction(objectId: string, formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  await prisma.objectMember.upsert({
    where: { objectId_userId: { objectId, userId } },
    create: { objectId, userId, permission: "UPLOAD" },
    update: {},
  });
  await writeAuditLog({ action: "USER_ASSIGNED_TO_OBJECT", entityType: "ObjectMember", entityId: objectId, metadata: { userId, via: "admin_panel" } });
  redirect(`/admin/objects/${objectId}`);
}
