"use client";
import { useState } from "react";

export function WorkshopSignOut() {
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  async function logout() {
    setBusy(true);setError("");
    try {
      const csrf = document.cookie.split("; ").find(c=>c.startsWith("ks_csrf="))?.slice(8) || "";
      const result = await fetch("/api/werkplaats/session",{method:"DELETE",headers:{"x-csrf-token":decodeURIComponent(csrf)}});
      if (!result.ok) throw new Error();
      window.location.assign("/login");
    } catch {setError("Uitloggen lukt niet. Probeer opnieuw.");setBusy(false);}
  }
  return <><button className="button-secondary" disabled={busy} onClick={logout}>Uitloggen</button>{error && <span role="alert">{error}</span>}</>;
}
