"use client";

import { useActionState, useEffect, useState } from "react";
import { signInAction, type LoginState } from "@/app/login/actions";

export function LoginForm() {
  const [mounted, setMounted] = useState(false);
  const [state, action, pending] = useActionState<LoginState, FormData>(
    signInAction,
    { status: "idle" }
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="panel">Inlogformulier laden...</div>;
  }

  return (
    <form action={action} className="panel">
      <div className="field">
        <label htmlFor="email">E-mailadres</label>
        <input id="email" name="email" type="email" placeholder="age@heftrucks.frl" />
      </div>
      <div className="field">
        <label htmlFor="password">Wachtwoord</label>
        <input id="password" name="password" type="password" />
      </div>
      {state.status === "error" ? (
        <p style={{ color: "var(--danger)" }}>{state.message}</p>
      ) : null}
      <div className="actions">
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Bezig..." : "Inloggen"}
        </button>
      </div>
    </form>
  );
}
