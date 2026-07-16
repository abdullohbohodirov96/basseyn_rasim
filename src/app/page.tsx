import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container">
      <div className="card">
        <h1>🏊 Pool Construction Bot</h1>
        <p className="muted">
          This service hosts the Telegram bot webhook and the admin panel.
        </p>
        <p>
          <Link className="btn" href="/admin/login">
            Open admin panel
          </Link>
        </p>
        <p className="muted">
          Health check: <Link href="/api/health">/api/health</Link>
        </p>
      </div>
    </div>
  );
}
