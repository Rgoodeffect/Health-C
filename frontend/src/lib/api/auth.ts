import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export interface WhoAmI {
  user: string;
  full_name: string;
  user_image: string | null;
  language: "en" | "ar";
  roles: string[];
  is_portal_user: boolean;
  patient: { name: string; patient_name: string } | null;
}

export function useWhoAmI() {
  return useQuery({
    queryKey: ["whoami"],
    queryFn: () => frappe.get<WhoAmI>("healthcare_erp.api.auth.whoami"),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { usr: string; pwd: string }) => frappe.post("login", vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whoami"] }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => frappe.post("logout"),
    onSuccess: () => queryClient.clear(),
  });
}
