"use client";

import { useActionState } from "react";
import { signInAction, type LoginState } from "@/app/login/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    signInAction,
    { status: "idle" }
  );

  return (
    <form action={action} className="panel" autoComplete="on">
      <div className="field">
        <label htmlFor="email">E-mailadres</label>
        <input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required placeholder="age@heftrucks.frl" />
      </div>
      <div className="field">
        <label htmlFor="password">Wachtwoord</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required aria-describedby="password-save-help" />
      </div>
      <div id="password-save-help">
        <p>Wachtwoord onthouden? Kies na het inloggen voor ‘Opslaan’ in je browser of wachtwoordmanager op je eigen apparaat.</p>
        <details>
          <summary>Geen vraag om je wachtwoord op te slaan?</summary>
          <p>Open de instellingen van je browser of wachtwoordmanager en schakel het aanbieden van wachtwoordopslag in. Staat deze website bij ‘Nooit opslaan’ of geblokkeerde websites? Verwijder hem uit die lijst en log opnieuw in. Je kunt deze website en je inloggegevens ook zelf toevoegen aan je wachtwoordmanager.</p>
        </details>
      </div>
      {state.status === "error" ? (
        <p role="alert" style={{ color: "var(--danger)" }}>{state.message}</p>
      ) : null}
      <div className="actions">
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Bezig..." : "Inloggen"}
        </button>
      </div>
    </form>
  );
}
