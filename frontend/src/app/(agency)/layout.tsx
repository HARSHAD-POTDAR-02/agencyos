import type { Metadata } from "next";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "AgencyOS — Dashboard",
};

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden antialiased">
      <Suspense fallback={<div className="w-64 bg-[#0B0F19]" />}>
        <Sidebar />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Suspense fallback={<div className="h-14 bg-white border-b border-slate-200/80" />}>
          <Header />
        </Suspense>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading...</div>}>
            {children}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
