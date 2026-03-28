import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZhiNotes",
  description: "Offline-first knowledge management for investment research",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
        {children}
      </body>
    </html>
  );
}
