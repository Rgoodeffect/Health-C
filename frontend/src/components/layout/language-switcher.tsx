"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabel, routing } from "@/i18n/routing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { frappe } from "@/lib/api/frappe-client";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(nextLocale: string) {
    // Instant switch, no logout: swap the /en|/ar route segment client-side
    // and persist the choice on the User record for next login.
    router.replace(pathname, { locale: nextLocale as "en" | "ar" });
    frappe.post("healthcare_erp.api.auth.set_language", { language: nextLocale }).catch(() => {
      /* best-effort — locale still switches client-side even if not logged in */
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Switch language">
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => switchTo(l)} className={l === locale ? "font-semibold" : undefined}>
            {localeLabel[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
