import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboard() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const [activeObjects, archivedObjects, totalPhotos, totalUsers] = await Promise.all([
    prisma.constructionObject.count({ where: { status: "ACTIVE" } }),
    prisma.constructionObject.count({ where: { status: "ARCHIVED" } }),
    prisma.photo.count({ where: { deletedAt: null } }),
    prisma.user.count(),
  ]);

  return (
    <div className="container">
      <h1>Bosh sahifa</h1>
      <div className="grid-photos">
        <div className="card">
          <div className="muted">Faol obyektlar</div>
          <h2>{activeObjects}</h2>
        </div>
        <div className="card">
          <div className="muted">Arxivlangan obyektlar</div>
          <h2>{archivedObjects}</h2>
        </div>
        <div className="card">
          <div className="muted">Jami rasmlar</div>
          <h2>{totalPhotos}</h2>
        </div>
        <div className="card">
          <div className="muted">Foydalanuvchilar</div>
          <h2>{totalUsers}</h2>
        </div>
      </div>
    </div>
  );
}
