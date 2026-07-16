import { loginAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h1>Admin panel</h1>
        {error === "invalid" && <p style={{ color: "var(--danger)" }}>Login yoki parol noto&apos;g&apos;ri.</p>}
        {error === "rate_limited" && <p style={{ color: "var(--danger)" }}>Juda ko&apos;p urinish. Birozdan so&apos;ng qayta urining.</p>}
        <form action={loginAction}>
          <input name="username" placeholder="Username" autoComplete="username" required />
          <input name="password" type="password" placeholder="Password" autoComplete="current-password" required />
          <button className="btn" type="submit">
            Kirish
          </button>
        </form>
      </div>
    </div>
  );
}
