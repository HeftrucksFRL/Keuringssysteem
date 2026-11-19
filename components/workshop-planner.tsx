"use client";

import { normalizeWorkshopTransports,transportRelease,returnWorkshopJob,moveTransportTicket } from "@/lib/workshop-transport";
import { prepareWorkshopSave,workshopDocumentDate,filterWorkshopDocuments } from "@/lib/workshop";
import { isoWeek,dutchHolidays } from "@/lib/calendar";
import { useEffect,useRef,useState } from "react";
import {useRouter} from "next/navigation";
import "@/modules/werkplaats/assets/planning.css";

const workflow={documentDate:workshopDocumentDate,documents:filterWorkshopDocuments,normalize:normalizeWorkshopTransports,prepare:prepareWorkshopSave,release:transportRelease,returnJob:returnWorkshopJob,moveTransport:moveTransportTicket};
type MountOptions={onModeChange?:(mode:"workshop"|"driver")=>void;api?:string;initialMode?:string;workflow?:typeof workflow;calendar?:{isoWeek:typeof isoWeek;dutchHolidays:typeof dutchHolidays};readOnly:boolean;isActive:()=>boolean};
declare global {interface Window {
  HFWorkshopMount?:(root:HTMLElement,options:MountOptions)=>Promise<(()=>void)|undefined>;
  hfWorkshopScript?:Promise<void>;
}}
function loadPlanner(){
  if(window.HFWorkshopMount)return Promise.resolve();
  if(!window.hfWorkshopScript)window.hfWorkshopScript=new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');script.src='/werkplaats-preview/assets/planning.js?v=20261119-navigation-v3';script.async=true;
    script.onload=()=>resolve();script.onerror=()=>{window.hfWorkshopScript=undefined;script.remove();reject(new Error('Werkplaatsagenda laden is niet gelukt.'));};document.head.appendChild(script);
  });
  return window.hfWorkshopScript;
}
export function WorkshopPlanner({connected,readOnly,initialMode="workshop"}:{connected:boolean;readOnly:boolean;initialMode?:"workshop"|"driver"|"archive"}){
  const router=useRouter();
  const host=useRef<HTMLDivElement>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true,dispose:(()=>void)|undefined;const surface=document.createElement('div');surface.dataset.workshopPlanner='';surface.dataset.workshopInline='';host.current?.appendChild(surface);
    void(async()=>{try{await loadPlanner();if(!active)return;const cleanup=await window.HFWorkshopMount?.(surface,{...(!readOnly?{onModeChange:(mode:'workshop'|'driver')=>router.push(mode==='driver'?'/planning/transport':'/planning/werkplaats')}:{}),...(connected?{api:'/api/werkplaats'}:{}),readOnly,initialMode,calendar:{isoWeek,dutchHolidays},workflow,isActive:()=>active});if(!active)cleanup?.();else{dispose=cleanup;setLoading(false);}}catch(e){if(active){setError(e instanceof Error?e.message:'Laden mislukt.');setLoading(false);}}})();
    return()=>{active=false;dispose?.();surface.remove();};
  },[connected,readOnly,initialMode,router]);
  return <>
    {loading&&<p role="status">Werkplaatsagenda laden…</p>}
    {error&&<p role="alert">{error} Vernieuw de pagina om opnieuw te proberen.</p>}
    <div ref={host}/>
  </>;
}
