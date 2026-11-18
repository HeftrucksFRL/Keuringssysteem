"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { readWorkshopOrders } from "@/components/workshop-orders";
import { orderNeedsPurchase,type WorkshopOrder } from "@/lib/workshop-orders";

export function WorkshopOrderAlert({demo}:{demo:boolean}){
  const [orders,setOrders]=useState<WorkshopOrder[]>([]),[error,setError]=useState("");
  useEffect(()=>{
    let active=true,sequence=0;
    async function load(){const current=++sequence;try{const data=await readWorkshopOrders(demo);if(active&&current===sequence){setOrders(data.orders.filter(o=>orderNeedsPurchase(o.status)));setError("");}}catch{if(active&&current===sequence)setError("Bestellingen konden niet worden bijgewerkt. Open de bestellijst om te controleren.");}}
    const refresh=()=>{if(!document.hidden)void load();};
    void load();const timer=setInterval(refresh,30000);
    window.addEventListener('workshop-orders-changed',refresh);window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('workshop-orders-changed',refresh);window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[demo]);
  const fresh=orders.filter(o=>o.status==='Nieuw').length;
  return <div><Link className="button-secondary workshop-order-button" href="/werkplaats/bestellingen" aria-label={`Bestellijst: ${fresh} nieuwe bestellingen, ${orders.length} te bestellen`} title={`${orders.length} te bestellen · ${fresh} nieuw`}>
    Bestellijst{fresh>0&&<span className="workshop-order-badge" aria-hidden="true">{fresh>99?'99+':fresh}</span>}
  </Link><span className="workshop-order-sr" role="status">{fresh?`${fresh} nieuwe bestellingen`:''}</span>{error&&<p className="workshop-order-error" role="alert">{error}</p>}</div>;
}
