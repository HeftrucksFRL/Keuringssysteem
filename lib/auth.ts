import { createClient } from "@/lib/supabase/server";
import { appConfig, hasSupabaseConfig } from "@/lib/env";

export interface ActivityActor {
  id: string;
  email: string;
  name: string;
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

export async function requireActivityActor(): Promise<ActivityActor> {
  const user = await requireUser();
  return {
    id: String(user?.id ?? "demo-user"),
    email: String(user?.email ?? "demo@heftrucks.frl"),
    name: String(user?.user_metadata?.full_name ?? user?.email ?? appConfig.defaultInspector)
  };
}
