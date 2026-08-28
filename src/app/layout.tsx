import type { Metadata } from "next";
import "@fontsource-variable/libre-franklin";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Natalie Trainer",
    template: "%s · Natalie Trainer",
  },
  description: "IB technical interview trainer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
