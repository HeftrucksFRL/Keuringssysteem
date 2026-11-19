"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import {isWorkshopJobClosed} from "@/lib/workshop";
import type { WorkshopJob } from "@/lib/workshop";
type Entry=Pick<WorkshopJob,'id'|'number'|'machine'|'task'|'status'|'date'|'completedAt'|'actualMinutes'>;
export function WorkshopHistory({customerId,machineId,demo}:{customerId?:string;machineId?:string;demo:boolean}){
 const [jobs,setJobs]=useState<Entry[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;async function load(){try{let rows:Entry[];if(demo){const all:WorkshopJob[]=JSON.parse(localStorage.getItem("hf-workshop-agenda-v2")||'{"jobs":[]}').jobs;rows=all.filter(j=>machineId?j.machineId===machineId:j.customerId===customerId);}else{const query=new URLSearchParams(machineId?{machineId}:{customerId:customerId||''});const r=await fetch('/api/werkplaats?'+query,{cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error(data.message);rows=data.jobs;}if(active){setJobs(rows.sort((a,b)=>(b.completedAt||b.date).localeCompare(a.completedAt||a.date)));setError('');}}catch{if(active)setError('Werkbonhistorie kon niet worden geladen.');}finally{if(active)setLoading(false);}}void load();return()=>{active=false;};},[demo,customerId,machineId]);
 return <section className="panel" style={{marginTop:"1rem"}}><h2>Werkbonnen & werkplaatshistorie</h2>{loading?<p>Laden…</p>:error?<p role="alert">{error}</p>:!jobs.length?<p>Nog geen gekoppelde werkbonnen.</p>:<div className="list">{jobs.map(job=><Link key={job.id} className="list-item" href={{pathname:isWorkshopJobClosed(job)?"/werkbonnen":"/werkplaats",query:{job:job.id}}}><span><strong>{job.number} · {job.machine}</strong><br/>{job.task}<br/>{job.completedAt?"Afgerond op "+new Date(job.completedAt).toLocaleDateString("nl-NL",{timeZone:"Europe/Amsterdam"}):job.date||"Nog te plannen"}{job.actualMinutes!==undefined?" · Gewerkt: "+Math.floor(job.actualMinutes/60)+" uur "+job.actualMinutes%60+" min":""}</span><strong>{isWorkshopJobClosed(job)?"Afgerond":job.status}</strong></Link>)}</div>}</section>;
}
