"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  status: "idle" | "error";
  message?: string;
}

export async function signInAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!hasSupabaseConfig) {
    redirect("/");
  }

  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return {
      status: "error",
      message: "Inloggen is niet gelukt. Controleer je e-mail en wachtwoord."
    };
  }

  redirect("/");
}

export async function signOutAction() {
  if (!hasSupabaseConfig) {
    redirect("/");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login" as Route);
}
