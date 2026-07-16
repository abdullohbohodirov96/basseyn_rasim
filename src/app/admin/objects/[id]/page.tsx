import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/r2";
import { formatDateTashkent, formatTimeTashkent } from "@/lib/utils";
import {
  archiveObjectAction,
  restoreObjectAction,
  updatePhotoCommentAction,
  assignUserToObjectAction,
} from "../../actions";

const PAGE_SIZE = 24;

export default async function AdminObjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(0, Number(pageStr ?? 0));

  const object = await prisma.constructionObject.findUnique({ where: { id } });
  if (!object) {
    return (
      <div className="container">
        <p>Obyekt topilmadi.</p>
      </div>
    );
  }

  const [total, photos, members, allUsers] = await Promise.all([
    prisma.photo.count({ where: { objectId: id, deletedAt: null } }),
    prisma.photo.findMany({
      where: { objectId: id, deletedAt: null },
      orderBy: { uploadedAt: "desc" },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { uploadedBy: true },
    }),
    prisma.objectMember.findMany({ where: { objectId: id }, include: { user: true } }),
    prisma.user.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  const photosWithUrls = await Promise.all(
    photos.map(async (p) => ({
      ...p,
      previewUrl: await getSignedDownloadUrl(p.previewStorageKey),
      originalUrl: await getSignedDownloadUrl(p.originalStorageKey, p.originalFilename),
    }))
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const memberIds = new Set(members.map((m) => m.userId));

  return (
    <div className="container">
      <h1>{object.name}</h1>
      <p className="muted">
        Holati: <span className="badge">{object.status}</span> · {total} ta rasm
      </p>

      <div className="card" style={{ display: "flex", gap: 12 }}>
        {object.status === "ACTIVE" ? (
          <form action={archiveObjectAction.bind(null, object.id)}>
            <button className="btn" type="submit">
              Arxivlash
            </button>
          </form>
        ) : (
          <form action={restoreObjectAction.bind(null, object.id)}>
            <button className="btn" type="submit">
              Qayta tiklash
            </button>
          </form>
        )}
      </div>

      <div className="card">
        <h3>Biriktirilgan foydalanuvchilar</h3>
        <ul>
          {members.map((m) => (
            <li key={m.id}>
              {m.user.fullName} — {m.permission}
            </li>
          ))}
        </ul>
        <form action={assignUserToObjectAction.bind(null, object.id)} style={{ display: "flex", gap: 8 }}>
          <select name="userId" required>
            {allUsers
              .filter((u) => !memberIds.has(u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
          </select>
          <button className="btn" type="submit">
            Biriktirish
          </button>
        </form>
      </div>

      <h3>Rasmlar</h3>
      <div className="grid-photos">
        {photosWithUrls.map((p) => (
          <div key={p.id} className="card">
            <a href={p.originalUrl} target="_blank" rel="noreferrer">
              <img src={p.previewUrl} alt={p.originalFilename} />
            </a>
            <p className="muted">
              {formatDateTashkent(p.uploadedAt)} {formatTimeTashkent(p.uploadedAt)} · {p.uploadedBy.fullName}
            </p>
            <form action={updatePhotoCommentAction.bind(null, p.id, "", object.id)}>
              <textarea name="comment" defaultValue={p.comment ?? ""} rows={2} />
              <button className="btn" type="submit">
                Saqlash
              </button>
            </form>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {page > 0 && <a className="btn" href={`?page=${page - 1}`}>Oldingi</a>}
        {page < totalPages - 1 && <a className="btn" href={`?page=${page + 1}`}>Keyingi</a>}
      </div>
    </div>
  );
}
