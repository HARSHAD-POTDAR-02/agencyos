import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgencyOS — Operating System for Social Media Agencies",
  description: "Workflow and delivery management from onboarding to campaign delivery, approvals and reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans antialiased bg-slate-50 text-slate-900 selection:bg-purple-500/20 selection:text-purple-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
