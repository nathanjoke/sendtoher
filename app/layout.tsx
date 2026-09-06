import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SendToHer — Send files. No account.",
  description:
    "Transfer files between two devices quickly and simply, with a 4-digit code. No account, no login.",
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
