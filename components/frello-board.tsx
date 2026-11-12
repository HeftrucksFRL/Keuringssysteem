"use client";
import { Fragment,useCallback,useEffect,useLayoutEffect,useRef,useState,type FormEvent,type PointerEvent as ReactPointerEvent } from "react";
import { initialFrelloState,moveFrelloCard,frelloDropBefore,persistFrelloOptimistically,validateFrelloUpload,type FrelloBoard,type FrelloCard,type FrelloState,type FrelloFile } from "@/lib/frello";
import "./frello-board.css";

const demoKey="hf-frello-demo-v1";
type DemoStore={boards:FrelloBoard[];files:(FrelloFile&{data:string})[]};
function demoData():DemoStore{const saved=localStorage.getItem(demoKey);if(saved)return JSON.parse(saved);const state=initialFrelloState();state.cards.push({id:crypto.randomUUID(),columnId:state.columns[0].id,title:"Voorbeeld • Nieuwe heftruckaanvraag",description:"Klant wil weten welke elektrische heftruck bij het magazijn past. Plan een belafspraak en bespreek de inzet.",company:"Voorbeeldbedrijf",contact:"Contactpersoon",email:"",phone:"",assignee:"Renze",dueDate:"",labels:["Verkoop"],checklist:[],comments:[],archived:false});return {boards:[{id:"f0000000-0000-4000-8000-000000000001",title:"Leads Age & Renze",visibility:"shared",owner_id:null,version:0,state,updated_at:new Date().toISOString()}],files:[]};}
async function api(method:string,body?:unknown,id?:string){const token=document.cookie.split("; ").find(c=>c.startsWith("ks_csrf="))?.slice(8)||"";const r=await fetch('/api/frello'+(id?'?id='+encodeURIComponent(id):''),{method,cache:"no-store",headers:{"Content-Type":"application/json","x-csrf-token":decodeURIComponent(token)},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw new Error(data.message||"Opslaan mislukt.");return data;}
const pretty=(date:string)=>new Date(date+"T12:00:00").toLocaleDateString("nl-NL",{day:"numeric",month:"short"});

export function FrelloBoardView({demo,author,userId}:{demo:boolean;author:string;userId:string}){
  const [boards,setBoards]=useState<FrelloBoard[]>([]),[board,setBoard]=useState<FrelloBoard|null>(null),[files,setFiles]=useState<FrelloFile[]>([]);
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [card,setCard]=useState<FrelloCard|null>(null),[newCard,setNewCard]=useState(false),[creatingBoard,setCreatingBoard]=useState(false),[editingColumns,setEditingColumns]=useState(false);
  const [boardMenu,setBoardMenu]=useState(false);
  const [search,setSearch]=useState(""),[assigned,setAssigned]=useState(""),[archives,setArchives]=useState(false),[dragging,setDragging]=useState<string|null>(null);
  const [dropTarget,setDropTarget]=useState<{columnId:string;beforeId?:string}|null>(null),[dragHeight,setDragHeight]=useState(120),[landed,setLanded]=useState<string|null>(null);
  const root=useRef<HTMLDivElement>(null),dragId=useRef<string|null>(null),target=useRef<typeof dropTarget>(null),ghost=useRef<HTMLElement|null>(null),positions=useRef(new Map<string,DOMRect>()),interaction=useRef(0),landingTimer=useRef<ReturnType<typeof setTimeout>|null>(null),pointerCleanup=useRef<(()=>void)|null>(null),suppressClickUntil=useRef(0);
  const modal=useRef<HTMLDialogElement>(null),fileInput=useRef<HTMLInputElement>(null),lock=useRef(false),selectedId=useRef<string|null>(null);
  const personId=demo?`demo-${author.toLowerCase()}`:userId;
  const isOpen=Boolean(card||creatingBoard||editingColumns||boardMenu);
  useEffect(()=>{if(isOpen&&modal.current&&!modal.current.open)modal.current.showModal();},[isOpen]);
  const load=useCallback(async(id?:string)=>{
    if(lock.current||dragId.current)return;
    const epoch=interaction.current;
    setLoading(true);
    try{let list:FrelloBoard[];
      if(demo){const data=demoData();list=data.boards.filter(b=>b.visibility==="shared"||b.owner_id===personId);setBoards(list);const current=list.find(b=>b.id===(id||selectedId.current))||list[0]||null;setBoard(current);selectedId.current=current?.id||null;setFiles(data.files.filter(f=>f.board_id===current?.id));}
      else{list=(await api("GET")).boards;const chosen=list.find(b=>b.id===(id||selectedId.current))||list[0];const data=chosen?await api("GET",undefined,chosen.id):null;if(epoch!==interaction.current||lock.current||dragId.current)return;setBoards(list);if(data){setBoard(data.board);selectedId.current=data.board.id;setFiles(data.files);}else{setBoard(null);setFiles([]);}}
      setError("");
    }catch(e){setError(e instanceof Error?e.message:"Laden is mislukt.");}finally{setLoading(false);}
  },[demo,personId]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden&&!isOpen&&!dragging&&!lock.current)void load();},30000);return()=>clearInterval(timer);},[load,isOpen,dragging]);
  function close(){if(busy)return;setCard(null);setNewCard(false);setCreatingBoard(false);setEditingColumns(false);setBoardMenu(false);setError("");}
  async function save(state:FrelloState,title=board?.title,optimistic=false){
    if(!board||lock.current)return false;lock.current=true;setBusy(true);setError("");
    interaction.current++;
    if(optimistic)setNotice("Verplaatsing opslaan…");
    const persist=async()=>{let updated:FrelloBoard;
      if(demo){const data=demoData(),current=data.boards.find(b=>b.id===board.id);if(!current||current.version!==board.version)throw new Error("Bord is intussen gewijzigd. Sluit het concept en vernieuw eerst.");updated={...current,state,title:title||current.title,version:current.version+1,updated_at:new Date().toISOString()};localStorage.setItem(demoKey,JSON.stringify({...data,boards:data.boards.map(b=>b.id===updated.id?updated:b)}));}
      else updated=(await api("PUT",{id:board.id,version:board.version,title,state})).board;
      return updated;
    };
    try{const updated=optimistic?await persistFrelloOptimistically(board,{...board,state},persist,setBoard):await persist();
      if(!optimistic)setBoard(updated);setBoards(all=>all.map(b=>b.id===updated.id?updated:b));setNotice("Opgeslagen");return true;
    }catch(e){if(optimistic)setNotice("");setError((optimistic?"Niet opgeslagen: de kaart is teruggezet. ":"")+(e instanceof Error?e.message:"Opslaan mislukt."));return false;}finally{setBusy(false);lock.current=false;}
  }
  function startCard(columnId:string){setError("");setNewCard(true);setCard({id:crypto.randomUUID(),columnId,title:"",description:"",company:"",contact:"",email:"",phone:"",assignee:"",dueDate:"",labels:[],checklist:[],comments:[],archived:false});}
  async function saveCard(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!card||!board?.state)return;const f=new FormData(event.currentTarget),str=(name:string)=>String(f.get(name)||"").trim();const comment=str("comment");const next:FrelloCard={...card,title:str("title"),columnId:str("columnId"),description:str("description"),company:str("company"),contact:str("contact"),email:str("email"),phone:str("phone"),assignee:str("assignee") as FrelloCard["assignee"],dueDate:str("dueDate"),labels:Array.from(new Set(str("labels").split(',').map(s=>s.trim()).filter(Boolean))),checklist:card.checklist.map(i=>({...i,text:str('check-'+i.id),done:f.has('done-'+i.id)})).filter(i=>i.text),comments:comment?[...card.comments,{id:crypto.randomUUID(),text:comment,author,createdAt:new Date().toISOString()}]:card.comments};
    if(next.labels.length>12){setError("Gebruik maximaal 12 labels.");return;}
    const ok=await save({...board.state,cards:newCard?[...board.state.cards,next]:board.state.cards.map(c=>c.id===card.id?next:c)});if(ok){setCard(null);setNewCard(false);}
  }
  async function createBoard(e:FormEvent<HTMLFormElement>){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError("");const f=new FormData(e.currentTarget),title=String(f.get('title')||'').trim(),visibility=String(f.get('visibility')) as 'private'|'shared';try{let created:FrelloBoard;if(demo){created={id:crypto.randomUUID(),title,visibility,owner_id:personId,version:0,updated_at:new Date().toISOString(),state:initialFrelloState()};const data=demoData();localStorage.setItem(demoKey,JSON.stringify({...data,boards:[...data.boards,created]}));}else created=(await api("POST",{title,visibility})).board;setBoards(all=>[...all,created]);setBoard(created);selectedId.current=created.id;setFiles([]);setCreatingBoard(false);setNotice(visibility==='private'?"Privébord gemaakt. Alleen jij ziet dit bord.":"Gezamenlijk bord gemaakt.");}catch(e){setError(e instanceof Error?e.message:"Bord maken is mislukt.");}finally{lock.current=false;setBusy(false);}}
  function rememberPositions(){positions.current=new Map(Array.from(root.current?.querySelectorAll<HTMLElement>('[data-frello-card]')||[]).map(el=>[el.dataset.frelloCard!,el.getBoundingClientRect()]));}
  useLayoutEffect(()=>{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){positions.current.clear();return;}
    root.current?.querySelectorAll<HTMLElement>('[data-frello-card]').forEach(el=>{const id=el.dataset.frelloCard!,before=positions.current.get(id),after=el.getBoundingClientRect();if(before&&id!==dragId.current&&id!==landed&&(before.x!==after.x||before.y!==after.y))el.animate([{transform:`translate(${before.x-after.x}px,${before.y-after.y}px)`},{transform:'translate(0,0)'}],{duration:170,easing:'cubic-bezier(.2,.8,.2,1)'});});
    positions.current.clear();
  },[dropTarget,board,landed]);
  useEffect(()=>()=>{pointerCleanup.current?.();ghost.current?.remove();if(landingTimer.current)clearTimeout(landingTimer.current);},[]);
  function beginDrag(e:ReactPointerEvent<HTMLButtonElement>,id:string){
    if(lock.current||loading||archives||e.button!==0)return;
    pointerCleanup.current?.();
    const source=e.currentTarget,rect=source.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,pointer=e.pointerId;
    let x=sx,y=sy,active=false,frame=0;
    const tick=()=>{
      if(!active)return;
      if(ghost.current)ghost.current.style.transform=`translate3d(${x-(sx-rect.left)}px,${y-(sy-rect.top)}px,0) rotate(-4deg)`;
      const column=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-frello-column]');
      if(column&&root.current?.contains(column)){
        const columnId=column.dataset.frelloColumn!;
        const cards=Array.from(column.querySelectorAll<HTMLElement>('[data-frello-card]')).filter(el=>el.dataset.frelloCard!==id).map(el=>{const r=el.getBoundingClientRect();return {id:el.dataset.frelloCard!,top:r.top,height:r.height};});
        const slot=column.querySelector<HTMLElement>(".fr-drop-slot")?.getBoundingClientRect();
        const beforeId=target.current?.columnId===columnId&&slot&&y>=slot.top&&y<=slot.bottom?target.current.beforeId:frelloDropBefore(cards,y);
        if(target.current?.columnId!==columnId||target.current.beforeId!==beforeId){rememberPositions();target.current={columnId,beforeId};setDropTarget(target.current);}
      }else if(target.current){rememberPositions();target.current=null;setDropTarget(null);}
      const scroll=root.current?.querySelector<HTMLElement>('.fr-columns');if(scroll){const r=scroll.getBoundingClientRect();if(y>=r.top&&y<=r.bottom){if(x>r.right-45)scroll.scrollLeft+=12;else if(x<r.left+45)scroll.scrollLeft-=12;}}
      if(y>innerHeight-60)window.scrollBy(0,12);else if(y<60)window.scrollBy(0,-12);
      frame=requestAnimationFrame(tick);
    };
    const move=(ev:PointerEvent)=>{if(ev.pointerId!==pointer)return;x=ev.clientX;y=ev.clientY;
      if(!active&&Math.hypot(x-sx,y-sy)>=5){active=true;interaction.current++;dragId.current=id;target.current=null;setDragHeight(rect.height);rememberPositions();
        const image=source.cloneNode(true) as HTMLElement;image.removeAttribute('data-frello-card');image.setAttribute('aria-hidden','true');image.classList.add('fr-drag-preview');image.style.width=rect.width+'px';image.style.height=rect.height+'px';root.current?.appendChild(image);ghost.current=image;
        setDragging(id);setLanded(null);setDropTarget(null);frame=requestAnimationFrame(tick);
      }if(active)ev.preventDefault();
    };
    const cleanup=()=>{cancelAnimationFrame(frame);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',key);window.removeEventListener('blur',cancel);pointerCleanup.current=null;endDrag();};
    const cancel=()=>{if(active)suppressClickUntil.current=Date.now()+350;active=false;cleanup();};
    const key=(ev:KeyboardEvent)=>{if(ev.key==='Escape')cancel();};
    const up=(ev:PointerEvent)=>{if(ev.pointerId!==pointer)return;const column=document.elementFromPoint(ev.clientX,ev.clientY)?.closest<HTMLElement>('[data-frello-column]');
      let destination=target.current;
      if(!column||!root.current?.contains(column))destination=null;
      else if(destination?.columnId!==column.dataset.frelloColumn){const cards=Array.from(column.querySelectorAll<HTMLElement>('[data-frello-card]')).filter(el=>el.dataset.frelloCard!==id).map(el=>{const r=el.getBoundingClientRect();return {id:el.dataset.frelloCard!,top:r.top,height:r.height};});destination={columnId:column.dataset.frelloColumn!,beforeId:frelloDropBefore(cards,ev.clientY)};}
      const wasActive=active;active=false;if(wasActive){suppressClickUntil.current=Date.now()+350;ev.preventDefault();}rememberPositions();cleanup();if(wasActive&&destination)void drop(id,destination);};
    pointerCleanup.current=cancel;document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('keydown',key);window.addEventListener('blur',cancel);
  }
  function endDrag(){ghost.current?.remove();ghost.current=null;dragId.current=null;target.current=null;setDragging(null);setDropTarget(null);}
  async function drop(id:string,destination:{columnId:string;beforeId?:string}){
    if(!board?.state||lock.current)return;
    const next=moveFrelloCard(board.state,id,destination.columnId,destination.beforeId);if(next===board.state)return;
    setLanded(id);if(landingTimer.current)clearTimeout(landingTimer.current);landingTimer.current=setTimeout(()=>setLanded(null),200);
    await save(next,board.title,true);
  }
  function dropSlot(){return <div className="fr-drop-slot" style={{height:dragHeight}} aria-hidden="true"><span>Hier neerzetten</span></div>;}
  async function upload(file:File){if(!card||newCard||!board||busy)return;if(!validateFrelloUpload(file.name,file.size)){setError("Kies een ondersteund bestand van maximaal 4 MB.");return;}setBusy(true);lock.current=true;setError("");try{let attachment:FrelloFile;if(demo){const encoded=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);});attachment={id:crypto.randomUUID(),board_id:board.id,card_id:card.id,name:file.name,size:file.size,created_at:new Date().toISOString()};const data=demoData();localStorage.setItem(demoKey,JSON.stringify({...data,files:[...data.files,{...attachment,data:encoded}]}));}
    else{const data=new FormData();data.set('boardId',board.id);data.set('cardId',card.id);data.set('file',file);const csrf=document.cookie.split('; ').find(c=>c.startsWith('ks_csrf='))?.slice(8)||'';const r=await fetch('/api/frello/bijlagen',{method:'POST',headers:{'x-csrf-token':decodeURIComponent(csrf)},body:data});const result=await r.json();if(!r.ok)throw new Error(result.message||'Upload mislukt.');attachment=result.file;}
    setFiles(all=>[...all,attachment]);setNotice("Bijlage toegevoegd.");
  }catch(e){setError(e instanceof Error?e.message:"Opslaan van de bijlage mislukt. De proefbrowser kan vol zijn.");}finally{setBusy(false);lock.current=false;if(fileInput.current)fileInput.current.value='';}}
  function download(file:FrelloFile){if(!demo){window.open('/api/frello/bijlagen?id='+encodeURIComponent(file.id),'_blank','noopener');return;}const stored=demoData().files.find(f=>f.id===file.id);if(stored){const a=document.createElement('a');a.href=stored.data;a.download=file.name;a.click();}}
  const current=board?.state;
  const shown=current?.cards.filter(c=>c.archived===archives&&(!assigned||c.assignee===assigned)&&`${c.title} ${c.company} ${c.contact} ${c.labels.join(' ')}`.toLowerCase().includes(search.toLowerCase()))||[];
  return <div data-client-interaction ref={root} className={`fr ${dragging ? "fr-dragging" : ""}`}>
    <header className="fr-compact-header"><div><div className="fr-eyebrow">FRELLOBORD{demo?` · PROEFVERSIE ALS ${author.toUpperCase()}`:''}</div><h1>{board?.title||'Frellobord'}</h1><div className="fr-board-meta"><span>{board?.visibility==='private'?'🔒 Alleen voor jou':'Gezamenlijk bord'}</span><span>{shown.length} {archives?'gearchiveerde ':''}kaarten</span>{(assigned||search||archives)&&<button className="fr-clear-filter" onClick={()=>{setAssigned('');setSearch('');setArchives(false);}}>Filters wissen ×</button>}</div></div><div className="fr-compact-actions"><div className="fr-owner-legend" aria-label="Kaartkleuren"><span className="fr-legend-age">Age</span><span className="fr-legend-renze">Renze</span></div><button disabled={busy} onClick={()=>{setError('');setBoardMenu(true);}}>Bord bewerken</button></div></header>
    {!isOpen&&error&&<p role="alert" className="fr-error">{error}</p>}{notice&&<p role="status" className="fr-notice">{notice}</p>}
    {loading&&!board?<p>Frellobord laden…</p>:current?<div className="fr-columns">{current.columns.map(column=><section key={column.id} className={`fr-column ${dropTarget?.columnId===column.id?'fr-drop-target':''}`} data-frello-column={column.id} aria-label={column.name}><h3>{column.name}<span>{shown.filter(c=>c.columnId===column.id).length}</span></h3>{shown.filter(c=>c.columnId===column.id).map(c=><Fragment key={c.id}>{dropTarget?.columnId===column.id&&dropTarget.beforeId===c.id&&dropSlot()}<button data-frello-card={c.id} className={`fr-card ${dragging===c.id ? "fr-is-dragging" : ""} ${landed===c.id ? "fr-just-dropped" : ""} ${c.assignee === "Age" ? "fr-owner-age" : c.assignee === "Renze" ? "fr-owner-renze" : ""}`} draggable={false} onPointerDown={e=>beginDrag(e,c.id)} onClick={()=>{if(dragId.current||Date.now()<suppressClickUntil.current)return;setError('');setNewCard(false);setCard(structuredClone(c));}}><div className="fr-labels">{c.labels.map(l=><span key={l}>{l}</span>)}</div><strong>{c.title}</strong>{c.company&&<p>{c.company}</p>}<div className="fr-card-foot">{c.assignee&&<span className="fr-assignee">{c.assignee}</span>}{c.dueDate&&<span className={new Date(c.dueDate+'T23:59:59')<new Date()?'fr-overdue':''}>◷ {pretty(c.dueDate)}</span>}{c.checklist.length>0&&<span>☑ {c.checklist.filter(i=>i.done).length}/{c.checklist.length}</span>}{files.some(f=>f.card_id===c.id)&&<span>📎 {files.filter(f=>f.card_id===c.id).length}</span>}{c.comments.length>0&&<span>☷ {c.comments.length}</span>}</div></button></Fragment>)}{dropTarget?.columnId===column.id&&!dropTarget.beforeId&&dropSlot()}{!archives&&<button className="fr-add" onClick={()=>startCard(column.id)}>＋ Kaart toevoegen</button>}</section>)}</div>:!error&&<p>Maak je eerste bord aan.</p>}
    {isOpen&&<dialog ref={modal} className="fr-modal" onCancel={e=>{e.preventDefault();close();}} aria-labelledby="fr-title">
      <div className="fr-modal-top"><h2 id="fr-title">{boardMenu?'Bord bewerken':creatingBoard?'Nieuw Frellobord':editingColumns?'Bord & kolommen':newCard?'Nieuwe lead':card?.title}</h2><button type="button" disabled={busy} onClick={close} aria-label="Sluiten">✕</button></div>
      {boardMenu&&<div className="fr-settings"><label>Bord kiezen<select value={board?.id||''} onChange={e=>void load(e.target.value)} disabled={busy||loading}>{boards.map(b=><option key={b.id} value={b.id}>{b.visibility==='private'?'🔒 ':''}{b.title}</option>)}</select></label><div className="fr-fields"><label>Verantwoordelijke<select value={assigned} onChange={e=>setAssigned(e.target.value)}><option value="">Iedereen</option><option>Age</option><option>Renze</option></select></label><label>Zoeken<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Lead, bedrijf, label…"/></label></div><label className="fr-archive-toggle"><input type="checkbox" checked={archives} onChange={e=>setArchives(e.target.checked)}/>Gearchiveerde kaarten tonen</label><div className="fr-settings-buttons"><button onClick={()=>{setBoardMenu(false);setCreatingBoard(true);}}>＋ Nieuw bord</button><button disabled={!board||loading} onClick={()=>{setBoardMenu(false);setEditingColumns(true);}}>Bordnaam & kolommen</button><button disabled={loading} onClick={()=>void load()}>Vernieuwen</button></div><p>Kaarten van Age zijn blauw, kaarten van Renze zijn paars. De naam blijft ook op de kaart zichtbaar.</p>{error&&<p role="alert" className="fr-error">{error}</p>}<div className="fr-actions"><button className="fr-primary" onClick={close}>Toon bord</button></div></div>}
      {creatingBoard?<form onSubmit={createBoard}><label>Bordnaam<input name="title" required autoFocus maxLength={100}/></label><label>Zichtbaarheid<select name="visibility" defaultValue="private"><option value="private">Privé · alleen ik</option><option value="shared">Gezamenlijk · Age en Renze</option></select></label><p>Een privébord verschijnt niet bij de ander. De zichtbaarheid staat na aanmaken vast.</p>{error&&<p role="alert" className="fr-error">{error}</p>}<div className="fr-actions"><button type="button" onClick={close}>Annuleren</button><button className="fr-primary" disabled={busy}>Bord maken</button></div></form>:editingColumns&&current?<form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const columns=current.columns.map(c=>({...c,name:String(f.get(c.id)||'').trim()}));const name=String(f.get('newColumn')||'').trim();if(name)columns.push({id:crypto.randomUUID(),name});if(columns.length>30){setError('Maximaal 30 kolommen.');return;}if(await save({...current,columns},String(f.get('title')||'').trim()))setEditingColumns(false);}}><label>Bordnaam<input name="title" defaultValue={board?.title} maxLength={100} required autoFocus/></label>{current.columns.map(c=><label key={c.id}>Kolom<input name={c.id} defaultValue={c.name} maxLength={80} required/></label>)}<label>Nieuwe kolom (optioneel)<input name="newColumn" maxLength={80}/></label>{error&&<p role="alert" className="fr-error">{error}</p>}<div className="fr-actions"><button type="button" onClick={close}>Annuleren</button><button className="fr-primary" disabled={busy}>Opslaan</button></div></form>:card&&current&&<form onSubmit={saveCard}>
        <div className="fr-card-layout"><section><label>Titel<input name="title" defaultValue={card.title} required maxLength={180} autoFocus/></label><label>Beschrijving / notities<textarea name="description" defaultValue={card.description} rows={5} maxLength={10000}/></label><div className="fr-fields"><label>Bedrijf<input name="company" defaultValue={card.company} maxLength={180}/></label><label>Contactpersoon<input name="contact" defaultValue={card.contact} maxLength={180}/></label><label>E-mailadres<input name="email" defaultValue={card.email} type="email" maxLength={254}/></label><label>Telefoon<input name="phone" defaultValue={card.phone} maxLength={80}/></label></div>
        <h3>Checklist</h3>{card.checklist.map(i=><div className="fr-check" key={i.id}><input aria-label={`Afgerond: ${i.text}`} type="checkbox" name={'done-'+i.id} defaultChecked={i.done}/><input aria-label="Checklistpunt" name={'check-'+i.id} defaultValue={i.text} maxLength={500}/></div>)}<button type="button" disabled={card.checklist.length>=100} onClick={()=>setCard({...card,checklist:[...card.checklist,{id:crypto.randomUUID(),text:'Nieuw checklistpunt',done:false}]})}>＋ Checklistpunt</button>
        <h3>Reacties</h3>{card.comments.map(m=><article className="fr-comment" key={m.id}><strong>{m.author}</strong><small>{new Date(m.createdAt).toLocaleString('nl-NL')}</small><p>{m.text}</p></article>)}<label>Reactie toevoegen<textarea name="comment" rows={2} maxLength={10000}/></label>
        <h3>Bijlagen</h3>{files.filter(f=>f.card_id===card.id).map(f=><button type="button" className="fr-file" key={f.id} onClick={()=>download(f)}>📎 {f.name} <small>{Math.ceil(f.size/1024)} KB · downloaden</small></button>)}{newCard?<p>Sla de kaart eerst op. Daarna kun je bestanden toevoegen.</p>:<label>Bestand toevoegen (maximaal 4 MB)<input ref={fileInput} type="file" disabled={busy||card.archived} accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0]);}}/></label>}
        </section><aside><label>Kolom<select name="columnId" defaultValue={card.columnId}>{current.columns.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Verantwoordelijke<select name="assignee" defaultValue={card.assignee}><option value="">Nog toewijzen</option><option>Age</option><option>Renze</option></select></label><label>Opvolgdatum<input name="dueDate" type="date" defaultValue={card.dueDate}/></label><label>Labels (komma’s ertussen)<input name="labels" defaultValue={card.labels.join(', ')} maxLength={500} placeholder="Verkoop, Verhuur, Spoed"/></label><p className="fr-privacy">{board?.visibility==='private'?'🔒 Deze kaart staat op jouw privébord.':'Age en Renze kunnen deze kaart bekijken en bewerken.'}</p>{!newCard&&<button type="button" disabled={busy} onClick={async()=>{if(await save({...current,cards:current.cards.map(c=>c.id===card.id?{...c,archived:!c.archived}:c)}))setCard(null);}}>{card.archived?'Terugzetten uit archief':'Kaart archiveren'}</button>}</aside></div>
        {error&&<p role="alert" className="fr-error">{error}</p>}<div className="fr-actions"><button type="button" disabled={busy} onClick={close}>Annuleren</button><button className="fr-primary" disabled={busy}>{busy?'Opslaan…':'Kaart opslaan'}</button></div>
      </form>}
    </dialog>}
  </div>;
}
