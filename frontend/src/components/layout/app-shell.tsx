"use client";

import * as React from "react";
import { useWhoAmI } from "@/lib/api/auth";
import { useRouter } from "@/i18n/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { FrappeApiError } from "@/lib/api/frappe-client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading, isError, error } = useWhoAmI();
  const router = useRouter();

  React.useEffect(() => {
    if (isError && error instanceof FrappeApiError && error.httpStatus === 403) {
      router.replace("/login");
    }
  }, [isError, error, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const roles = me?.data.roles ?? [];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar roles={roles} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar me={me?.data} roles={roles} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette roles={roles} />
    </div>
  );
}
