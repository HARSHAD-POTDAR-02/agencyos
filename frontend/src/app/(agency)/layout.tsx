"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/lib/auth-context";

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!token) {
        router.replace("/login");
      } else if (user?.is_client) {
        router.replace("/portal");
      }
    }
  }, [user, token, isLoading, router]);

  return (
    <div className="flex h-screen bg-[#101014] text-[#F2F0F7] overflow-hidden antialiased print:h-auto print:overflow-visible print:bg-white">
      <div className="print:hidden h-full flex flex-col">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
        <div className="print:hidden">
          <Suspense fallback={null}>
            <Header />
          </Suspense>
        </div>
        <div className="flex-1 overflow-y-auto relative print:overflow-visible bg-[#101014]">
          {(!isLoading && user?.is_client) && (
            <div className="absolute inset-0 z-50 bg-[#101014] flex items-center justify-center">
              <div className="w-8 h-8 border-[3px] border-[#A78BFA] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
