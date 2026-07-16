import Link from "next/link";
import { getAdminSession } from "@/lib/admin-auth";
import { logoutAction } from "./actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    // Covers /admin/login itself, and acts as a defense-in-depth fallback
    // if middleware.ts's cookie-presence check ever passes without a valid
    // signed session (getAdminSession() does the real HMAC verification).
    return <>{children}</>;
  }

  return (
    <div>
      <nav style={{ borderBottom: "1px solid #334155", padding: "12px 16px", display: "flex", gap: 16, alignItems: "center" }}>
        <strong>🏊 Admin</strong>
        <Link href="/admin">Bosh sahifa</Link>
        <Link href="/admin/objects">Obyektlar</Link>
        <Link href="/admin/users">Foydalanuvchilar</Link>
        <Link href="/admin/audit-logs">Audit</Link>
        <span className="muted">{session.username}</span>
        <form action={logoutAction} style={{ marginLeft: "auto" }}>
          <button className="btn" type="submit">
            Chiqish
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
