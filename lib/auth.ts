import { createClient } from "@/lib/supabase/server";
import { appConfig, hasSupabaseConfig } from "@/lib/env";

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
