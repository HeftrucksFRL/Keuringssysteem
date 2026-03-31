import { hasSupabaseConfig } from "@/lib/env";

export async function AuthStatus() {
  return (
    <span className="badge blue">
      {hasSupabaseConfig() ? "Open toegang actief" : "Demo-modus actief"}
    </span>
  );
}
