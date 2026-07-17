"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useLogin } from "@/lib/api/auth";
import { useRouter } from "@/i18n/navigation";
import { FrappeApiError } from "@/lib/api/frappe-client";
import { toast } from "sonner";

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const login = useLogin();
  const [usr, setUsr] = React.useState("");
  const [pwd, setPwd] = React.useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    login.mutate(
      { usr, pwd },
      {
        onSuccess: () => router.push("/dashboard"),
        onError: (err) => {
          const message = err instanceof FrappeApiError ? t("invalidCredentials") : t("genericError");
          toast.error(message);
        },
      }
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-accent/40 to-background p-4">
      <div className="absolute end-4 top-4 flex items-center gap-1">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-primary text-primary-foreground">
            <Activity className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="usr">{t("email")}</Label>
              <Input id="usr" type="text" autoComplete="username" value={usr} onChange={(e) => setUsr(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd">{t("password")}</Label>
              <Input id="pwd" type="password" autoComplete="current-password" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? t("signingIn") : t("signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
