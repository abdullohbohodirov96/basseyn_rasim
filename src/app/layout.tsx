import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pool Construction Bot Admin",
  description: "Admin panel for the swimming pool construction Telegram bot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
