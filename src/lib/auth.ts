import { prisma } from "./prisma";
import { Role, ObjectPermission, User } from "@prisma/client";
import { getEnv } from "./env";

export const UNAUTHORIZED_MESSAGE =
  "⛔ Sizda ushbu botdan foydalanish uchun ruxsat mavjud emas. Administratorga murojaat qiling.";

/**
 * Finds the acting user by their Telegram id, auto-provisioning the
 * INITIAL_ADMIN_TELEGRAM_ID as an ADMIN on first contact.
 */
export async function getOrBootstrapUser(telegramId: string, username?: string): Promise<User | null> {
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing) return existing;

  const env = getEnv();
  if (telegramId === env.INITIAL_ADMIN_TELEGRAM_ID.trim()) {
    return prisma.user.create({
      data: {
        telegramId,
        username,
        fullName: "Administrator",
        role: Role.ADMIN,
        isActive: true,
      },
    });
  }
  return null;
}

export function isActiveUser(user: User | null): user is User {
  return !!user && user.isActive;
}

export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  WORKER: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export function hasRoleAtLeast(user: User, role: Role): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[role];
}

export const can = {
  manageUsers: (u: User) => u.role === Role.ADMIN,
  createObject: (u: User) => u.role === Role.ADMIN || u.role === Role.MANAGER,
  renameObject: (u: User) => u.role === Role.ADMIN || u.role === Role.MANAGER,
  archiveObject: (u: User) => u.role === Role.ADMIN || u.role === Role.MANAGER,
  restoreObject: (u: User) => u.role === Role.ADMIN,
  permanentlyDeleteObject: (u: User) => u.role === Role.ADMIN,
  editAnyComment: (u: User) => u.role === Role.ADMIN,
  deleteAnyComment: (u: User) => u.role === Role.ADMIN,
  viewAuditLogs: (u: User) => u.role === Role.ADMIN,
  uploadPhotos: (u: User) => u.role !== Role.VIEWER,
};

/** ADMIN and MANAGER see every active object; WORKER/VIEWER only see assigned ones. */
export function seesAllObjects(user: User): boolean {
  return user.role === Role.ADMIN || user.role === Role.MANAGER;
}

export async function getUserObjectPermission(
  userId: string,
  objectId: string
): Promise<ObjectPermission | null> {
  const membership = await prisma.objectMember.findUnique({
    where: { objectId_userId: { objectId, userId } },
  });
  return membership?.permission ?? null;
}

export async function assertCanAccessObject(user: User, objectId: string): Promise<boolean> {
  if (seesAllObjects(user)) return true;
  const permission = await getUserObjectPermission(user.id, objectId);
  return permission !== null;
}
