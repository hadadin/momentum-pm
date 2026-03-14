import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Momentum PM",
  description: "AI-native product manager operating system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
