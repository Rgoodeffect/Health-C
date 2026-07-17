"use client";

import { Menu, Search, Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { SidebarNav } from "./sidebar-nav";
import { useUiStore } from "@/lib/store/ui-store";
import { useLogout, type WhoAmI } from "@/lib/api/auth";
import { useRouter } from "@/i18n/navigation";

export function Topbar({ me, roles }: { me: WhoAmI | undefined; roles: string[] }) {
  const t = useTranslations("topbar");
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const logout = useLogout();
  const router = useRouter();

  const initials = (me?.full_name || me?.user || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("menu")}>
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="start" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("menu")}</SheetTitle>
          </SheetHeader>
          <SidebarNav roles={roles} />
        </SheetContent>
      </Sheet>

      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex h-10 flex-1 max-w-md items-center gap-2 rounded-[var(--radius-md)] border border-input bg-muted/60 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-start">{t("searchPlaceholder")}</span>
        <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ms-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label={t("notifications")}>
          <Bell className="h-4 w-4" />
        </Button>
        <ThemeToggle />
        <LanguageSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ms-1 flex items-center gap-2 rounded-full">
              <Avatar>
                <AvatarImage src={me?.user_image ?? undefined} alt={me?.full_name} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium text-foreground">{me?.full_name}</p>
              <p className="text-xs text-muted-foreground">{roles[0]}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout.mutate(undefined, { onSuccess: () => router.push("/login") })}>
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
