"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { readWorkshopOrders } from "@/components/workshop-orders";
import { orderNeedsPurchase,type WorkshopOrder } from "@/lib/workshop-orders";

export function WorkshopOrderAlert({demo}:{demo:boolean}){
  const [orders,setOrders]=useState<WorkshopOrder[]>([]),[error,setError]=useState("");
  useEffect(()=>{let active=true;async function load(){try{const data=await readWorkshopOrders(demo);if(active){setOrders(data.orders.filter(o=>orderNeedsPurchase(o.status)));setError("");}}catch{if(active)setError("De bestellijst kan nu niet worden geladen.");}}void load();const timer=setInterval(()=>{if(!document.hidden)void load();},30000);return()=>{active=false;clearInterval(timer);};},[demo]);
  return <section className="panel" style={{marginTop:"1rem",borderLeft:"4px solid #005ea8"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div><div className="eyebrow">WERKPLAATS</div><h2>Te bestellen · {orders.length}</h2><p>{error||`${orders.filter(o=>o.details.urgency==="Spoed").length} spoedaanvragen · onderdelen, gereedschap en verbruiksmateriaal`}</p></div><Link className="button" href="/werkplaats/bestellingen">Open bestellijst →</Link></div>{orders.slice(0,3).map(o=><p key={o.id}><strong>{o.details.urgency==="Spoed"?"SPOED · ":""}{o.details.unit==="aanvraag"?o.details.item:`${o.details.quantity} ${o.details.unit} ${o.details.item}`}</strong> · {o.details.employeeName}</p>)}</section>;
}
