import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export default async function AdminObjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const { q, status } = await searchParams;
  const where = {
    ...(status === "ARCHIVED" ? { status: "ARCHIVED" as const } : status === "ALL" ? {} : { status: "ACTIVE" as const }),
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const objects = await prisma.constructionObject.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { photos: { where: { deletedAt: null } } } }, createdBy: true },
    take: 100,
  });

  return (
    <div className="container">
      <h1>Obyektlar</h1>
      <form className="card" method="get">
        <input name="q" placeholder="Qidiruv..." defaultValue={q ?? ""} />
        <select name="status" defaultValue={status ?? "ACTIVE"}>
          <option value="ACTIVE">Faol</option>
          <option value="ARCHIVED">Arxivlangan</option>
          <option value="ALL">Barchasi</option>
        </select>
        <button className="btn" type="submit">
          Qidirish
        </button>
      </form>

      <table className="card">
        <thead>
          <tr>
            <th>Nomi</th>
            <th>Holati</th>
            <th>Rasmlar</th>
            <th>Yaratuvchi</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {objects.map((o) => (
            <tr key={o.id}>
              <td>{o.name}</td>
              <td>
                <span className="badge">{o.status}</span>
              </td>
              <td>{o._count.photos}</td>
              <td>{o.createdBy.fullName}</td>
              <td>
                <Link href={`/admin/objects/${o.id}`}>Ko&apos;rish</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
