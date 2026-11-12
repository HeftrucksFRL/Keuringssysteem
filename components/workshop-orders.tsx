"use client";
import { useEffect,useState,useRef,useCallback,type FormEvent } from "react";
import Link from "next/link";
import { orderCategories,orderStatuses,orderIsOpen,orderNeedsPurchase,type OrderRequest,type WorkshopOrder } from "@/lib/workshop-orders";
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
const dateLabel=(v:string)=>v?new Date(v+"T12:00:00").toLocaleDateString("nl-NL"):"Geen vaste datum";

export function WorkshopOrders({demo,manager}:{demo:boolean;manager:boolean}){
  const [orders,setOrders]=useState<WorkshopOrder[]>([]),[planning,setPlanning]=useState<Planning>({employees:[],jobs:[]});
  const [canManage,setCanManage]=useState(manager),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true);
  const [creating,setCreating]=useState(false),[selected,setSelected]=useState<WorkshopOrder|null>(null),[requestId,setRequestId]=useState("");
  const [busy,setBusy]=useState(false),[filter,setFilter]=useState("open"),[search,setSearch]=useState(""),[limited,setLimited]=useState(false);
  const modal=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if((creating||selected)&&modal.current&&!modal.current.open)modal.current.showModal();},[creating,selected]);
  const load=useCallback(async()=>{
    try{const data=await readWorkshopOrders(demo);setOrders(data.orders);setLimited(Boolean(data.limited));if(!demo)setCanManage(data.canManage===true);
      if(demo){const saved=localStorage.getItem("hf-workshop-agenda-v2");setPlanning(saved?JSON.parse(saved):{employees:[{id:"jelle",name:"Jelle"},{id:"bauke",name:"Bauke"},{id:"timo",name:"Timo"},{id:"age",name:"Age"}],jobs:[]});}
      else{const r=await fetch("/api/werkplaats",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error("Werkplaatsmedewerkers konden niet worden geladen.");setPlanning(p.state);}
      setError("");
    }catch(e){setError(e instanceof Error?e.message:"Laden is niet gelukt.");}finally{setLoading(false);}
  },[demo]);
  useEffect(()=>{void load();const timer=setInterval(()=>{if(!document.hidden&&!creating&&!selected)void load();},30000);return()=>clearInterval(timer);},[load,creating,selected]); // Refresh only outside open forms.
  function saveDemo(next:WorkshopOrder[]){localStorage.setItem(demoKey,JSON.stringify(next));window.dispatchEvent(new Event("workshop-orders-changed"));}
  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;const form=event.currentTarget,f=new FormData(form),str=(n:string)=>String(f.get(n)||"").trim();
    const details:OrderRequest={id:requestId,item:str("item"),category:str("category") as OrderRequest["category"],quantity:Number(str("quantity")),unit:str("unit"),employeeId:str("employeeId"),jobId:str("jobId"),needBy:str("needBy"),urgency:str("urgency") as OrderRequest["urgency"],partNumber:str("partNumber"),notes:str("notes")};
    setBusy(true);setError("");
    try{let result:WorkshopOrder;
      if(demo){const employee=planning.employees.find(e=>e.id===details.employeeId),job=planning.jobs.find(j=>j.id===details.jobId);if(!employee)throw new Error("Kies een medewerker.");
        const latest=(await readWorkshopOrders(true)).orders,existing=latest.find(o=>o.id===requestId);result=existing||{id:requestId,details:{...details,employeeName:employee.name,jobNumber:job?.number||"",machine:job?.machine||""},status:"Nieuw",version:0,manager_note:"",supplier:"",reference:"",created_at:new Date().toISOString(),updated_at:new Date().toISOString()};saveDemo(existing?latest:[result,...latest]);
      }else result=await writeOrder("POST",details);
      setOrders(all=>[result,...all.filter(o=>o.id!==result.id)]);setCreating(false);setFilter("open");setSearch("");setNotice("Aanvraag verstuurd. Age en Renze zien hem in hun bestellijst.");
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
  const shown=orders.filter(o=>(filter==="all"||filter==="open"&&orderIsOpen(o.status)||o.status===filter)&&`${o.details.item} ${o.details.employeeName} ${o.details.partNumber} ${o.details.jobNumber} ${o.details.machine}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="wo">
    <div className="wo-banner">{demo?"PROEFVERSIE · Alleen in deze browser opgeslagen":"WERKPLAATS · Gedeelde bestellijst"}<span>Aanvragen zonder prijzen</span></div>
    <header className="wo-heading"><div><Link href="/werkplaats">← Werkplaatsagenda</Link><h1>Onderdelen & gereedschap</h1><p>Wat ontbreekt er? Vraag het aan, dan kunnen Age en Renze het bestellen.</p></div><button className="button" disabled={loading||!planning.employees.length} onClick={()=>{setRequestId(crypto.randomUUID());setCreating(true);setNotice("");setError("");}}>＋ Aanvraag maken</button></header>
    <div className="wo-stats"><div><strong>{orders.filter(o=>orderNeedsPurchase(o.status)).length}</strong> te bestellen</div><div><strong>{orders.filter(o=>orderIsOpen(o.status)&&o.details.urgency==="Spoed").length}</strong> spoed / open</div><div><strong>{orders.filter(o=>o.status==="Besteld").length}</strong> onderweg</div><div><strong>{orders.filter(o=>o.status==="Ontvangen").length}</strong> ontvangen</div></div>
    {!loading&&!planning.employees.length&&<p>Er staan nog geen medewerkers in de agenda. Laat Age of Renze eerst de namen toevoegen via Medewerkers.</p>}
    {error&&!creating&&!selected&&<p className="wo-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div className="wo-toolbar"><label>Status<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="open">Open aanvragen</option><option value="all">Alle aanvragen</option>{orderStatuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Zoeken<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Artikel, naam, werkbon…"/></label><button className="button-secondary" onClick={()=>void load()}>Vernieuwen</button></div>
    {limited&&<p>De nieuwste 5.000 aanvragen worden getoond.</p>}
    <div className="wo-list">{loading?<p>Laden…</p>:shown.length?shown.map(o=><button key={o.id} className="wo-card" onClick={()=>{setSelected(o);setError("");}}><div className="wo-card-title"><span className={`wo-status ${o.details.urgency==="Spoed"&&orderIsOpen(o.status)?"wo-urgent":""}`}>{o.details.urgency==="Spoed"&&orderIsOpen(o.status)?"SPOED · ":""}{o.status}</span><small>{new Date(o.created_at).toLocaleDateString("nl-NL")}</small></div><h2>{o.details.quantity} {o.details.unit} · {o.details.item}</h2><p>{o.details.category} · Aangevraagd door {o.details.employeeName}</p>{o.details.partNumber&&<p>Artikelnummer: {o.details.partNumber}</p>}{o.details.jobNumber&&<p>{o.details.jobNumber} · {o.details.machine}</p>}<div className="wo-card-bottom"><span>Nodig: {dateLabel(o.details.needBy)}</span><strong>{canManage?"Afhandelen →":"Aanvraag bekijken →"}</strong></div></button>):<p className="wo-empty">{error?"De lijst kan nu niet worden getoond.":"Geen aanvragen in deze selectie."}</p>}</div>
    {(creating||selected)&&<dialog ref={modal} className="wo-modal" aria-labelledby="wo-dialog-title" onCancel={e=>{e.preventDefault();if(!busy){setCreating(false);setSelected(null);setError("");}}}>
      <h2 id="wo-dialog-title">{creating?"Nieuwe aanvraag":selected?.details.item}</h2>
      {creating?<form onSubmit={create}>
        <div className="wo-fields"><label>Wie vraagt het aan?<select name="employeeId" required autoFocus><option value="">Kies je naam</option>{planning.employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>Categorie<select name="category">{orderCategories.map(c=><option key={c}>{c}</option>)}</select></label></div>
        <label>Wat heb je nodig?<input name="item" required maxLength={180} placeholder="Bijvoorbeeld kwasten of hydrauliekslang"/></label>
        <div className="wo-fields"><label>Aantal<input type="number" name="quantity" min="0.01" max="100000" step="0.01" defaultValue="1" required/></label><label>Eenheid<input name="unit" defaultValue="stuks" maxLength={40} required placeholder="Stuks, set, liter…"/></label><label>Artikelnummer (optioneel)<input name="partNumber" maxLength={180}/></label><label>Wanneer nodig? (optioneel)<input name="needBy" type="date"/></label><label>Prioriteit<select name="urgency"><option>Normaal</option><option>Spoed</option></select></label><label>Werkbon (optioneel)<select name="jobId"><option value="">Algemeen / geen werkbon</option>{planning.jobs.map(j=><option key={j.id} value={j.id}>{j.number} · {j.machine}</option>)}</select></label></div>
        <label>Toelichting / specificaties<textarea name="notes" rows={4} maxLength={3000} placeholder="Afmetingen, type, reden of gewenste uitvoering…"/></label>
        {error&&<p role="alert" className="wo-error">{error}</p>}<div className="wo-actions"><button type="button" disabled={busy} onClick={()=>{setCreating(false);setError("");}}>Annuleren</button><button className="button" disabled={busy}>{busy?"Versturen…":"Aanvraag versturen"}</button></div>
      </form>:selected&&<><div className="wo-details"><p><strong>{selected.details.quantity} {selected.details.unit}</strong> · {selected.details.category}</p><p>Aangevraagd door {selected.details.employeeName}<br/>Nodig: {dateLabel(selected.details.needBy)} · {selected.details.urgency}</p>{selected.details.partNumber&&<p>Artikelnummer: {selected.details.partNumber}</p>}{selected.details.jobNumber&&<p>Werkbon: {selected.details.jobNumber} · {selected.details.machine}</p>}<p className="wo-pre">{selected.details.notes||"Geen aanvullende specificaties."}</p></div>
        {canManage?<form onSubmit={update}><div className="wo-fields"><label>Status<select name="status" defaultValue={selected.status}>{orderStatuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Leverancier<input name="supplier" defaultValue={selected.supplier} maxLength={180}/></label></div><label>Bestelreferentie<input name="reference" defaultValue={selected.reference} maxLength={180}/></label><label>Terugkoppeling aan de werkplaats<textarea name="managerNote" rows={3} defaultValue={selected.manager_note} maxLength={3000}/></label>{error&&<p role="alert" className="wo-error">{error}</p>}<div className="wo-actions"><button type="button" disabled={busy} onClick={()=>{setSelected(null);setError("");}}>Sluiten</button><button className="button" disabled={busy}>{busy?"Opslaan…":"Wijzigingen opslaan"}</button></div></form>:<><p><strong>Status:</strong> {selected.status}</p><p className="wo-pre"><strong>Terugkoppeling:</strong> {selected.manager_note||"Nog geen terugkoppeling."}</p><div className="wo-actions"><button onClick={()=>setSelected(null)}>Sluiten</button></div></>}
      </>}
    </dialog>}
  </div>;
}
