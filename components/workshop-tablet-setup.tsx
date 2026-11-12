"use client";
import { useState, type FormEvent } from "react";

export function WorkshopTabletSetup({demo}:{demo:boolean}) {
  const [message,setMessage]=useState("");
  const [error,setError]=useState(false);
  const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=event.currentTarget;
    if(demo){setError(true);setMessage("Dit is de proefomgeving. Het tabletaccount kan na installatie in de echte app worden ingesteld.");return;}
    const data=new FormData(form);
    if(data.get("password")!==data.get("confirm")){setError(true);setMessage("De wachtwoorden zijn niet gelijk.");return;}
    setBusy(true);setMessage("");
    try {
      const csrf=document.cookie.split("; ").find(c=>c.startsWith("ks_csrf="))?.slice(8)||"";
      const response=await fetch("/api/werkplaats/tablet-account",{method:"POST",headers:{"Content-Type":"application/json","x-csrf-token":decodeURIComponent(csrf)},body:JSON.stringify({password:data.get("password"),operation:data.get("operation")})});
      const result=await response.json();setError(!response.ok);setMessage(result.message);
      if(response.ok)form.reset();
    }catch{setError(true);setMessage("Instellen is niet gelukt. Probeer opnieuw.");}finally{setBusy(false);}
  }
  return <form onSubmit={submit} autoComplete="off">
    <div className="field"><label htmlFor="tablet-operation">Wat wil je doen?</label><select id="tablet-operation" name="operation"><option value="create">Werkplaatsaccount aanmaken</option><option value="reset">Wachtwoord van bestaand werkplaatsaccount vervangen</option></select></div>
    <div className="field"><label htmlFor="tablet-password">Wachtwoord (minimaal 12 tekens)</label><input id="tablet-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
    <div className="field"><label htmlFor="tablet-confirm">Herhaal wachtwoord</label><input id="tablet-confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
    <p>Bewaar het gekozen wachtwoord in jullie wachtwoordmanager. Gebruik na vervangen het nieuwe wachtwoord bij het inloggen.</p>
    {message&&<p role="status" style={{color:error?"var(--danger)":"var(--success)"}}>{message}</p>}
    <button className="button" disabled={busy}>{busy?"Bezig…":"Account instellen"}</button>
  </form>;
}
