"use client";
import { useEffect,useState,useRef,useCallback,type FormEvent } from "react";
import Link from "next/link";
import { normalizeOrderRequest,orderStatuses,orderIsOpen,type SimpleOrder,type WorkshopOrder } from "@/lib/workshop-orders";
import "./workshop-orders.css";

const demoKey="hf-workshop-orders-v1";
type Planning={employees:{id:string;name:string}[];jobs:{id:string;number:string;machine:string}[]};
export async function readWorkshopOrders(demo:boolean):Promise<{orders:WorkshopOrder[];canManage?:boolean;limited?:boolean}>{
  if(demo)return {orders:JSON.parse(localStorage.getItem(demoKey)||"[]")};
  const r=await fetch("/api/werkplaats/bestellingen",{cache:"no-store"});const data=await r.json();if(!r.ok)throw new Error(data.message||"Bestellijst laden is niet gelukt.");return data;
}
async function writeOrder(method:string,payload:unknown){
  const token=document.cookie.split("; ").find(c=>c.startsWith("ks_csrf="))?.slice(8)||"";
  const r=await fetch("/api/werkplaats/bestellingen",{method,headers:{"Content-Type":"application/json","x-csrf-token":decodeURIComponent(token)},body:JSON.stringify(payload)});
  const result=await r.json();if(!r.ok)throw new Error(result.message||"Opslaan mislukt.");return result.order as WorkshopOrder;
}

export function WorkshopOrders({demo,manager}:{demo:boolean;manager:boolean}){
  const [orders,setOrders]=useState<WorkshopOrder[]>([]),[planning,setPlanning]=useState<Planning>({employees:[],jobs:[]});
  const [canManage,setCanManage]=useState(manager),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<WorkshopOrder|null>(null),[requestId,setRequestId]=useState("");
  const [busy,setBusy]=useState(false),[filter,setFilter]=useState("open"),[limited,setLimited]=useState(false);
  const modal=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(selected&&modal.current&&!modal.current.open)modal.current.showModal();},[selected]);
  useEffect(()=>{if(!selected)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous;};},[selected]);
  const load=useCallback(async()=>{
    try{const data=await readWorkshopOrders(demo);setOrders(data.orders);setLimited(Boolean(data.limited));if(!demo)setCanManage(data.canManage===true);
      if(demo){const saved=localStorage.getItem("hf-workshop-agenda-v2");setPlanning(saved?JSON.parse(saved):{employees:[{id:"jelle",name:"Jelle"},{id:"bauke",name:"Bauke"},{id:"timo",name:"Timo"},{id:"age",name:"Age"}],jobs:[]});}
      else{const r=await fetch("/api/werkplaats",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error("Werkplaatsmedewerkers konden niet worden geladen.");setPlanning(p.state);}
      setError("");
    }catch(e){setError(e instanceof Error?e.message:"Laden is niet gelukt.");}finally{setLoading(false);}
  },[demo]);
  useEffect(()=>{void load();const timer=setInterval(()=>{if(!document.hidden&&!selected)void load();},30000);return()=>clearInterval(timer);},[load,selected]); // Refresh only outside open forms.
  function saveDemo(next:WorkshopOrder[]){localStorage.setItem(demoKey,JSON.stringify(next));window.dispatchEvent(new Event("workshop-orders-changed"));}
  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;const form=event.currentTarget,f=new FormData(form),str=(n:string)=>String(f.get(n)||"").trim();
    const submission:SimpleOrder={id:requestId||crypto.randomUUID(),text:str("text"),employeeId:str("employeeId"),context:str("context")};setRequestId(submission.id);const details=normalizeOrderRequest(submission);
    setBusy(true);setError("");
    try{let result:WorkshopOrder;
      if(demo){const employee=planning.employees.find(e=>e.id===details.employeeId),job=planning.jobs.find(j=>j.number.toLowerCase()===submission.context.toLowerCase());if(!employee)throw new Error("Kies een medewerker.");
        const latest=(await readWorkshopOrders(true)).orders,existing=latest.find(o=>o.id===submission.id);result=existing||{id:submission.id,details:{...details,employeeName:employee.name,jobNumber:job?.number||"",machine:job?.machine||""},status:"Nieuw",version:0,manager_note:"",supplier:"",reference:"",created_at:new Date().toISOString(),updated_at:new Date().toISOString()};saveDemo(existing?latest:[result,...latest]);
      }else result=await writeOrder("POST",submission);
      setOrders(all=>[result,...all.filter(o=>o.id!==result.id)]);form.reset();setRequestId("");setFilter("open");setNotice("Aanvraag verstuurd. Age en Renze zien hem in hun bestellijst.");
    }catch(e){setError(e instanceof Error?e.message:"Aanvragen is niet gelukt.");}finally{setBusy(false);}
  }
  async function update(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!selected||!canManage||busy)return;const f=new FormData(event.currentTarget),str=(n:string)=>String(f.get(n)||"").trim();setBusy(true);setError("");
    try{const payload={id:selected.id,version:selected.version,status:str("status"),managerNote:str("managerNote"),supplier:str("supplier"),reference:str("reference")};let result:WorkshopOrder;
      if(demo){const latest=(await readWorkshopOrders(true)).orders,current=latest.find(o=>o.id===selected.id);if(!current||current.version!==selected.version)throw new Error("Deze aanvraag is intussen gewijzigd. Sluit de bon en vernieuw de lijst.");result={...current,status:payload.status as WorkshopOrder["status"],manager_note:payload.managerNote,supplier:payload.supplier,reference:payload.reference,version:current.version+1,updated_at:new Date().toISOString()};saveDemo(latest.map(o=>o.id===result.id?result:o));}
      else result=await writeOrder("PATCH",payload);
      setOrders(all=>all.map(o=>o.id===result.id?result:o));setSelected(null);setNotice("Aanvraag bijgewerkt.");
    }catch(e){setError(e instanceof Error?e.message:"Wijzigen is niet gelukt.");}finally{setBusy(false);}
  }
  const shown=orders.filter(o=>filter==="all"||orderIsOpen(o.status));
  return <div data-client-interaction className="wo">
    <div className="wo-banner">{demo?"PROEFVERSIE · Alleen in deze browser opgeslagen":"WERKPLAATS · Gedeelde bestellijst"}<span>Aanvragen zonder prijzen</span></div>
    <header className="wo-heading"><div><Link href="/werkplaats">← Werkplaatsagenda</Link><h1>Onderdelen & gereedschap</h1><p>Schrijf op wat nodig is. Age en Renze zien het in hun overzicht.</p></div></header>
    <form className="wo-compose" onSubmit={create}>
      <label>Wat moet er besteld worden?<textarea name="text" required rows={3} maxLength={3000} placeholder="Bijvoorbeeld: 3 kwasten en een hydrauliekslang voor de Linde"/></label>
      <div className="wo-fields"><label>Jouw naam<select name="employeeId" required><option value="">Kies je naam</option>{planning.employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>Werkbon / voorraad (optioneel)<input name="context" maxLength={180} placeholder="Bijvoorbeeld WB-0001 of voorraad"/></label></div>
      <button className="button" disabled={busy||loading||!planning.employees.length}>{busy?"Toevoegen…":"Toevoegen aan bestellijst"}</button><small>Datum en tijd worden automatisch vastgelegd.</small>
    </form>
    {error&&!selected&&<p className="wo-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div className="wo-toolbar"><h2>Bestellijst</h2><label><input type="checkbox" checked={filter==="all"} onChange={e=>setFilter(e.target.checked?"all":"open")}/> Ook afgehandeld tonen</label><button className="button-secondary" onClick={()=>void load()}>Vernieuwen</button></div>
    {limited&&<p>De nieuwste 5.000 aanvragen worden getoond.</p>}
    <div className="wo-list">{loading?<p>Laden…</p>:shown.length?shown.map(o=><button key={o.id} className="wo-card" onClick={()=>{setSelected(o);setError("");}}><div className="wo-card-title"><strong>{o.details.employeeName} · {o.details.context||o.details.jobNumber||"Algemeen"}</strong><time dateTime={o.created_at}>{new Date(o.created_at).toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam",dateStyle:"short",timeStyle:"short"})}</time></div><p className="wo-pre">{o.details.unit==="aanvraag"?o.details.notes:o.details.quantity+" "+o.details.unit+" · "+o.details.item+(o.details.notes?"\n"+o.details.notes:"")}</p><span className="wo-status">{o.status}</span>{o.manager_note&&<p>Terugkoppeling: {o.manager_note}</p>}</button>):<p className="wo-empty">{error?"De lijst kan nu niet worden getoond.":"Nog geen open aanvragen."}</p>}</div>
    {selected&&<dialog ref={modal} className="wo-modal" aria-labelledby="wo-dialog-title" onCancel={e=>{e.preventDefault();if(!busy){setSelected(null);setError("");}}}>
      <h2 id="wo-dialog-title">{selected.details.item}</h2>
      {selected&&<><div className="wo-details"><p>Aangevraagd door {selected.details.employeeName} · {new Date(selected.created_at).toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam"})}</p><p>{selected.details.context||selected.details.jobNumber||"Algemeen"}</p>{selected.details.partNumber&&<p>Artikelnummer: {selected.details.partNumber}</p>}{selected.details.jobNumber&&<p>Werkbon: {selected.details.jobNumber} · {selected.details.machine}</p>}<p className="wo-pre">{selected.details.notes||"Geen aanvullende specificaties."}</p></div>
        {canManage?<form onSubmit={update}><div className="wo-fields"><label>Status<select name="status" defaultValue={selected.status}>{orderStatuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Leverancier<input name="supplier" defaultValue={selected.supplier} maxLength={180}/></label></div><label>Bestelreferentie<input name="reference" defaultValue={selected.reference} maxLength={180}/></label><label>Terugkoppeling aan de werkplaats<textarea name="managerNote" rows={3} defaultValue={selected.manager_note} maxLength={3000}/></label>{error&&<p role="alert" className="wo-error">{error}</p>}<div className="wo-actions"><button type="button" disabled={busy} onClick={()=>{setSelected(null);setError("");}}>Sluiten</button><button className="button" disabled={busy}>{busy?"Opslaan…":"Wijzigingen opslaan"}</button></div></form>:<><p><strong>Status:</strong> {selected.status}</p><p className="wo-pre"><strong>Terugkoppeling:</strong> {selected.manager_note||"Nog geen terugkoppeling."}</p><div className="wo-actions"><button onClick={()=>setSelected(null)}>Sluiten</button></div></>}
      </>}
    </dialog>}
  </div>;
}
