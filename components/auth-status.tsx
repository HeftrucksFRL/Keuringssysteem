import Link from "next/link";
import type { Route } from "next";
import { signOutAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";

export async function AuthStatus() {
  const user = await getCurrentUser();
  const name =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Gebruiker";

  if (!hasSupabaseConfig()) {
    return <span className="badge blue">Demo: {name}</span>;
  }

  if (!user) {
    return (
      <Link className="button-secondary" href={"/login" as Route}>
        Inloggen
      </Link>
    );
  }

  return (
    <div className="inline-meta">
      <span className="badge blue">{name}</span>
      <form action={signOutAction}>
        <button className="button-secondary" type="submit">
          Uitloggen
        </button>
      </form>
    </div>
  );
}
