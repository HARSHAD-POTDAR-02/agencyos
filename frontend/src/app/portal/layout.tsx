import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AgencyOS — Client Review Portal",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#101014] text-[#F2F0F7] antialiased">
      {children}
    </div>
  );
}

