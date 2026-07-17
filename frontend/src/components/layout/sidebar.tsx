"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";

export function Sidebar({ roles }: { roles: string[] }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-e border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <SidebarNav roles={roles} collapsed={collapsed} />
      <div className="border-t border-sidebar-border p-2">
        <Button variant="ghost" size="sm" className="w-full justify-center" onClick={toggle} aria-label="Toggle sidebar">
          {collapsed ? <ChevronsRight className="h-4 w-4 rtl:rotate-180" /> : <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />}
        </Button>
      </div>
    </aside>
  );
}
