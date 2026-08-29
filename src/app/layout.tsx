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
  openGraph: {
    title: "NatalieTrainer",
    description:
      "Superday-grade IB interview training — a real interviewer across the table, honest scoring, and a mastery map that never lets you hide.",
    siteName: "NatalieTrainer",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
