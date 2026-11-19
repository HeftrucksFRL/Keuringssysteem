"use client";
import Link from "next/link";
import "./blank-workshop-form.css";
export function BlankWorkshopForm(){return <div className="blank-workshop-page"><nav><Link href="/werkplaats">← Werkplaats</Link><a className="button" href="/api/werkplaats/print" target="_blank" rel="noreferrer">Lege werkbon openen / afdrukken</a></nav><p>Hetzelfde formulier wordt gebruikt voor lege en ingevulde werkbonnen. Open de PDF en gebruik de afdrukknop in de PDF-lezer.</p><iframe title="Lege werkbon" src="/api/werkplaats/print" style={{width:"100%",height:"80vh",border:0}}/></div>;}
