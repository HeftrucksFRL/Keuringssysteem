import { createClient } from "@/lib/supabase/server";
import { appConfig, hasSupabaseConfig } from "@/lib/env";

export interface ActivityActor {
  id: string;
  email: string;
  name: string;
}

const activityLogViewerEmails = new Set(["info@heftruckopleiding.frl"]);

function toDisplayNamePart(value: string) {
  return value
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export async function getCurrentUser() {
  if (!hasSupabaseConfig()) {
    return {
      id: "demo-user",
      email: "demo@heftrucks.frl",
      user_metadata: {
        full_name: appConfig.defaultInspector
      }
    };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  return user;
}

export function getUserDisplayName(
  user:
    | { email?: string | null; user_metadata?: { full_name?: string | null } | null }
    | null
    | undefined
) {
  const fullName = String(user?.user_metadata?.full_name ?? "").trim();
  if (fullName) {
    return fullName;
  }

  const emailName = String(user?.email ?? "")
    .trim()
    .split("@")[0];
  if (emailName) {
    return toDisplayNamePart(emailName);
  }

  return appConfig.defaultInspector;
}

export function getUserFirstName(
  user:
    | { email?: string | null; user_metadata?: { full_name?: string | null } | null }
    | null
    | undefined
) {
  const displayName = getUserDisplayName(user).trim();
  return displayName.split(/\s+/)[0] || appConfig.defaultInspector.split(/\s+/)[0];
}

export function canViewActivityLog(
  user: { email?: string | null } | null | undefined
) {
  const email = String(user?.email ?? "")
    .trim()
    .toLowerCase();

  return activityLogViewerEmails.has(email);
}

export async function requireActivityActor(): Promise<ActivityActor> {
  const user = await requireUser();
  return {
    id: String(user?.id ?? "demo-user"),
    email: String(user?.email ?? "demo@heftrucks.frl"),
    name: getUserDisplayName(user)
  };
}
