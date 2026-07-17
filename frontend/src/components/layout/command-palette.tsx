"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { navItemsForRoles } from "@/lib/constants/nav";
import { useUiStore } from "@/lib/store/ui-store";

const QUICK_ACTIONS = [
  { key: "quick_register_patient", href: "/patients?new=1" },
  { key: "quick_new_appointment", href: "/appointments?new=1" },
  { key: "quick_checkin", href: "/reception?checkin=1" },
];

export function CommandPalette({ roles }: { roles: string[] }) {
  const t = useTranslations("nav");
  const tCmd = useTranslations("commandPalette");
  const router = useRouter();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const items = navItemsForRoles(roles);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={tCmd("title")}>
      <CommandInput placeholder={tCmd("placeholder")} />
      <CommandList>
        <CommandEmpty>{tCmd("empty")}</CommandEmpty>
        <CommandGroup heading={tCmd("quickActions")}>
          {QUICK_ACTIONS.map((action) => (
            <CommandItem key={action.key} onSelect={() => go(action.href)}>
              {tCmd(action.key)}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={tCmd("navigate")}>
          {items.map((item) => (
            <CommandItem key={item.key} onSelect={() => go(item.href)}>
              <item.icon className="h-4 w-4" />
              {t(item.key)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
