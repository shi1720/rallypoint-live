import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Rallypoint — Give every viewer a way in",
  description:
    "A live participation desk for Twitch. Turn arrivals into collaborators with a current mission, a clear chat action, and a welcome that includes everyone.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
