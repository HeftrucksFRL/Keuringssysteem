"use client";

import { useEffect,useRef,useState } from "react";
import "@/modules/werkplaats/assets/planning.css";

type MountOptions={api?:string;readOnly:boolean;isActive:()=>boolean};
declare global {interface Window {
  HFWorkshopMount?:(root:HTMLElement,options:MountOptions)=>Promise<(()=>void)|undefined>;
  hfWorkshopScript?:Promise<void>;
}}
function loadPlanner(){
  if(window.HFWorkshopMount)return Promise.resolve();
  if(!window.hfWorkshopScript)window.hfWorkshopScript=new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');script.src='/werkplaats-preview/assets/planning.js';script.async=true;
    script.onload=()=>resolve();script.onerror=()=>{window.hfWorkshopScript=undefined;script.remove();reject(new Error('Werkplaatsagenda laden is niet gelukt.'));};document.head.appendChild(script);
  });
  return window.hfWorkshopScript;
}
export function WorkshopPlanner({connected,readOnly}:{connected:boolean;readOnly:boolean}){
  const host=useRef<HTMLDivElement>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true,dispose:(()=>void)|undefined;const surface=document.createElement('div');surface.dataset.workshopPlanner='';surface.dataset.workshopInline='';host.current?.appendChild(surface);
    void(async()=>{try{await loadPlanner();if(!active)return;const cleanup=await window.HFWorkshopMount?.(surface,{...(connected?{api:'/api/werkplaats'}:{}),readOnly,isActive:()=>active});if(!active)cleanup?.();else{dispose=cleanup;setLoading(false);}}catch(e){if(active){setError(e instanceof Error?e.message:'Laden mislukt.');setLoading(false);}}})();
    return()=>{active=false;dispose?.();surface.remove();};
  },[connected,readOnly]);
  return <>
    {loading&&<p role="status">Werkplaatsagenda laden…</p>}
    {error&&<p role="alert">{error} Vernieuw de pagina om opnieuw te proberen.</p>}
    <div ref={host}/>
  </>;
}
