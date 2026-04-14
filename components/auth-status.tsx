import Link from "next/link";
import { signOutAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";

export async function AuthStatus() {
  if (!hasSupabaseConfig()) {
    return <span className="badge blue">Demo MVP actief</span>;
  }

  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link className="button-secondary" href="/login">
        Inloggen
      </Link>
    );
  }

  const displayName = String(user.email ?? "").trim() || "Keurmeester";

  return (
    <div className="inline-meta">
      <span className="badge blue">{displayName}</span>
      <form action={signOutAction}>
        <button className="button-secondary" type="submit">
          Uitloggen
        </button>
      </form>
    </div>
  );
}
