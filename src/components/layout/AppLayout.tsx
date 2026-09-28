import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { DotGrid } from "@/components/layout/DotGrid";

export function AppLayout({ email, children }: { email: string; children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar email={email} />
      {/* bg-transparent: o body já pinta o canvas — deixa a dotgrid aparecer */}
      <SidebarInset className="min-w-0 bg-transparent">
        <AppHeader />
        {/* ds-app: densidade de aplicação do DS; o padding é de cada página */}
        <main className="ds-app flex-1">
          <DotGrid />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
