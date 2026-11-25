(function () {
  'use strict';
  const STATUSES = ['Nieuw', 'Ingepland', 'Mee bezig', 'Wachten op onderdelen', 'Wachten op goedkeuring', 'Pauze', 'Werkbon-controle', 'On hold', 'Klaar voor transport','Afgerond','Geannuleerd'];
  const CHECKS=['Werkzaamheden uitgevoerd','Remmen en parkeerrem','Stuurinrichting','Mast en hefkettingen','Vorken en vorkenbord','Hydrauliek en lekkages','Banden en wielen','Verlichting en signalering','Batterij / motor en vloeistoffen','Veiligheid en eindcontrole'];
  const KINDS=['Klantreparatie','Verkooptruck','Voorraadtruck'];
  const completed=j=>Boolean(j?.deletedAt)||['Afgerond','Klaar voor transport','Geannuleerd'].includes(j?.status);
  const requiredDone=j=>!(j.requiredChecks||[]).some((needed,i)=>needed&&!j.checkedPoints?.[i]);
  const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const addDays = (s, n) => { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return localDate(d); };
  const weekStart = s => { const d = new Date(s+'T12:00:00'); return addDays(s, -(d.getDay()+6)%7); };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const minutes = t => Number(t.slice(0,2))*60+Number(t.slice(3));
  const endTime = (time,duration) => {const n=(minutes(time)+duration)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
  const durationUntil = (start,end) => (end==='00:00'?1440:minutes(end))-minutes(start);
  const spentTime = n => n===undefined?'Nog niet ingevuld':Math.floor(n/60)+' uur '+(n%60)+' min';
  const uid = () => crypto.randomUUID();
  const pretty = s => s ? new Date(s+'T12:00:00').toLocaleDateString('nl-NL',{day:'numeric',month:'short'}) : 'Niet gepland';
  const options = (values, selected) => values.map(v => `<option value="${esc(v.id ?? v)}" ${(v.id ?? v) === selected ? 'selected' : ''}>${esc(v.name ?? v)}</option>`).join('');
  const field = (label, name, value='', type='text', extra='') => `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  function seed() {
    const today = localDate(new Date()), monday = weekStart(today);
    const employees = [{id:'jelle',name:'Jelle',role:'mechanic'},{id:'bauke',name:'Bauke',role:'mechanic'},{id:'timo',name:'Timo',role:'mechanic'},{id:'age',name:'Age',role:'driver'},{id:'harm',name:'Harm',role:'driver'},{id:'renze',name:'Renze',role:'mechanic',canDrive:true}];
    const base = {serial:'DEMO-1234',notes:'',checks:[false,false,false],date:today,time:'08:00',duration:120,transport:null};
    return {employees,jobs:[
      {...base,id:uid(),number:'WB-0001',customer:'Voorbeeld • Groenvoorziening',machine:'Linde E20 · VM1234',task:'Remmen controleren, onderhoud uitvoeren en verlichting nalopen.',employee:'jelle',status:'Mee bezig',date:addDays(monday,3)},
      {...base,id:uid(),number:'WB-0002',customer:'Voorbeeld • Bouwbedrijf',machine:'Toyota 8FBE · VM1250',task:'Hydrauliekslang vervangen. Controleer op lekkage.',employee:'bauke',status:'Wachten op onderdelen',date:addDays(monday,4),notes:'Nieuwe slang besteld. Leverdatum nog bevestigen.'},
      {...base,id:uid(),number:'WB-0003',customer:'Voorbeeld • Magazijn',machine:'Still RX20 · VM1261',task:'Machine en lader aflevergereed maken.',employee:'timo',status:'Klaar voor transport',checks:[true,true,true],date:addDays(monday,3),time:'10:00',transport:{driver:'age',date:addDays(monday,4),time:'09:00',duration:60,pickup:'Eigen werkplaats',address:'Voorbeeldweg 3, Sneek',contact:'Magazijnbeheer · 06 0000 0000',instructions:'Neem de lader mee. Gebruik de ingang achterom.',state:'Gepland',confirmation:''}},
      {...base,id:uid(),number:'WB-0004',kind:'Voorraadtruck',estimatedMinutes:60,duration:60,customer:'Voorbeeld • Eigen voorraad',machine:'Jungheinrich EFG · VM1280',task:'Batterij testen en bevindingen noteren.',employee:'',status:'Nieuw',date:''}
    ]};
  }
  function collision(jobs, candidate, mode) {
    const c = mode === 'driver' ? candidate.transport : candidate;
    const person = mode === 'driver' ? c?.driver : c?.employee;
    if (!c || !c.date || !person || (mode === 'driver' && c.state === 'Afgeleverd')) return false;
    return jobs.some(j => {
      if (j.id === candidate.id || (mode === 'driver' ? j.status === 'Afgerond' : completed(j))) return false;
      const other = mode === 'driver' ? j.transport : j;
      if (!other || (mode === 'driver' && (j.status !== 'Klaar voor transport' || other.state === 'Afgeleverd'))) return false;
      return (mode === 'driver' ? other.driver : other.employee) === person && other.date === c.date && minutes(c.time) < minutes(other.time)+other.duration && minutes(other.time) < minutes(c.time)+c.duration;
    });
  }
  // The standalone preview uses the same transitions without the app's schema bundle.
  const fallbackWorkflow={
    normalize(state){const transports=(state.transports||[]).map(t=>({...t}));for(const job of state.jobs){const legacy=job.transport;if((job.transportRequired===true||legacy)&&!transports.some(t=>t.jobId===job.id))transports.push({id:'transport-'+job.id,jobId:job.id,kind:'Werkbon',title:job.number+' · '+job.machine,customer:job.customer,machine:job.machine,pickup:legacy?.pickup||'Eigen werkplaats',address:legacy?.address||job.deliveryAddress||'',contact:legacy?.contact||'',instructions:legacy?.instructions||'',driver:legacy?.driver||'',date:legacy?.date||'',appointmentTime:legacy?.time||'',position:transports.length,state:legacy?.state||'Nieuw',confirmation:legacy?.confirmation||'',...(legacy?{legacyReleased:true}:{})});}return {...state,transports,jobs:state.jobs.map(j=>({...j,...(j.status==='Klaar voor transport'?{status:'Afgerond',...(!j.completedAt&&j.officeApprovedAt?{completedAt:j.officeApprovedAt}:{})}:{}),transport:null}))};},
    release(ticket,jobs){if(ticket.deletedAt)return {allowed:false,label:'Transportbon verwijderd'};if(!ticket.jobId||ticket.legacyReleased)return {allowed:true,label:'Planbaar'};const job=jobs.find(j=>j.id===ticket.jobId);if(!job)return {allowed:false,label:'Werkbon ontbreekt'};if(!['Afgerond','Klaar voor transport'].includes(job.status))return {allowed:false,label:job.status==='Werkbon-controle'?'Wacht op kantoorcontrole':'Voorbereiden · werkplaats bezig'};return {allowed:!!job.invoicePaidAt,label:job.invoicePaidAt?'Betaald · planbaar':'Wacht op betaling'};},
    prepare(previous,next,at,permissions){if(previous.jobs.some(j=>!next.jobs.some(n=>n.id===j.id)))throw new Error('Afgeronde werkbonnen blijven bewaard.');for(const job of next.jobs){const old=previous.jobs.find(j=>j.id===job.id);if(job.status==='Afgerond'&&!completed(old)){if(!permissions.canApprove||old?.status!=='Werkbon-controle'||!requiredDone(job))throw new Error('De monteur moet de bon eerst compleet voor controle aanbieden.');job.officeApprovedAt=at;job.officeApprovedBy=permissions.approvedBy;job.completedAt=at;}if(job.invoicePaidAt&&(!['Afgerond','Klaar voor transport'].includes(job.status)||!job.invoiceReference))throw new Error('Sluit eerst de bon af en vul het factuurnummer in.');}const normalized=this.normalize(next);normalized.transports=normalized.transports.map(t=>{const job=next.jobs.find(j=>j.id===t.jobId),old=previous.jobs.find(j=>j.id===t.jobId);if(job?.transportRequired===false&&!t.deletedAt){if(['Onderweg','Afgeleverd'].includes(t.state))throw new Error('Een gestarte rit kan niet worden uitgezet.');return {...t,deletedAt:at};}if(job?.transportRequired===true&&old?.transportRequired===false&&t.deletedAt)return {...t,deletedAt:undefined,driver:'',date:'',state:'Nieuw'};return t;});normalized.transports=normalized.transports.filter(t=>!t.jobId||next.jobs.some(j=>j.id===t.jobId));for(const t of normalized.transports){if(t.deletedAt)continue;if(t.driver&&!this.release(t,next.jobs).allowed)throw new Error('Transport wacht op kantoorcontrole en betaling.');if(Boolean(t.driver)!==Boolean(t.date))throw new Error('Kies chauffeur en datum.');if(t.driver&&(!t.pickup.trim()||!t.address.trim()))throw new Error('Vul de ophaal- en afleveradressen in.');}return normalized;},
    returnJob(state,id,pool){const job=state.jobs.find(j=>j.id===id);if(!job||(job.kind==='Voorraadtruck')!==(pool==='stock'))throw new Error('Zet de werkbon terug in zijn eigen bak.');if(completed(job)||job.status==='Klaar voor transport')throw new Error('Deze werkbon is afgesloten.');return {...state,jobs:state.jobs.map(j=>j.id===id?{...j,employee:'',date:'',status:'Nieuw'}:j)};},
    moveTransport(state,id,destination){const ticket=state.transports.find(t=>t.id===id);if(!ticket)throw new Error('Transportbon niet gevonden.');if(ticket.deletedAt)throw new Error('Deze transportbon is verwijderd.');if(destination.driver&&!this.release(ticket,state.jobs).allowed)throw new Error('Transport wacht op kantoorcontrole en betaling.');return {...state,transports:state.transports.map(t=>t.id===id?{...t,...destination,state:destination.driver?'Gepland':'Nieuw'}:t)};}
  };

  function weekCarryDestination(date,visibleWeek,direction,alreadySwitched=false){const targetWeek=alreadySwitched?visibleWeek:addDays(visibleWeek,direction*7);const weekday=date?(new Date(date+'T12:00:00').getDay()+6)%7:0;return {week:targetWeek,date:addDays(targetWeek,weekday)};}
  // Expose deterministic scheduling rules for verification and integrations.
  if (typeof module !== 'undefined' && module.exports) module.exports = {collision,weekStart,addDays,endTime,durationUntil,weekCarryDestination};
  if (typeof document === 'undefined') return;
  window.HFWorkshopMount=init;
  document.querySelectorAll('[data-workshop-planner]:not([data-workshop-inline])').forEach(root=>void init(root));
  async function init(root, mountConfig) {
    root.dataset.clientInteraction="";
    const config = mountConfig || window.HFWorkshopConfig || {};
    const workflow=config.workflow||fallbackWorkflow;
    const calendar=config.calendar||window.HFCalendar||{isoWeek:value=>{const d=new Date(value+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));return {year:d.getUTCFullYear(),week:Math.ceil(((d-Date.UTC(d.getUTCFullYear(),0,1))/86400000+1)/7)};},dutchHolidays:()=>[]};
    const isDriver=p=>p.role==='driver'||p.canDrive===true;
    let canApprove=config.readOnly!==true;
    const demo = !config.api;
    let canEdit = config.readOnly!==true && new URLSearchParams(location.search).get('tablet')!=='1';
    let dialogCount=0,previousOverflow='';
    let state = demo ? seed() : {employees:[],jobs:[]}, version = 0, busy = false, baseState;
    let archiveFilters={year:'',month:'',date:'',status:['completed','deleted','open','cancelled','review'].includes(new URLSearchParams(location.search).get('status'))?new URLSearchParams(location.search).get('status'):'all',query:''};
    let mode=config.initialMode||'workshop', week=weekStart(localDate(new Date())), filter='', search='', message='', dragging=null;
    let stopPointerDrag=null,suppressClickUntil=0;
    const storageKey='hf-workshop-agenda-v2';
    if (demo) { try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved && Array.isArray(saved.jobs) && Array.isArray(saved.employees)) state=saved; } catch { message='Eerdere proefgegevens konden niet worden geladen.'; } }
    async function request(method, body, endpoint=config.api) {
      const csrf=document.cookie.split('; ').find(c=>c.startsWith('ks_csrf='))?.slice(8) || '';
      const response = await fetch(endpoint,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','x-csrf-token':decodeURIComponent(csrf)},...(body ? {body:JSON.stringify(body)} : {})});
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.message || 'Opslaan mislukt.'),{conflict:response.status===409});
      return data;
    }
    if (!demo) { root.innerHTML='<p class="hf-loading">Planning laden…</p>'; try { const result=await request('GET'); state=result.state;version=result.version;canEdit=result.canEdit===true;canApprove=result.canApprove===true; } catch(e) {root.innerHTML=`<p role="alert">${esc(e.message)} Vernieuw de pagina om opnieuw te proberen.</p>`;return;} }
    state=workflow.normalize(state);
    baseState=structuredClone(state);
    if(config.isActive&&!config.isActive())return;
    async function commit(next, optimistic=false) {
      if(!canEdit){message='Dit werkplaatsaccount heeft alleen kijkrechten.';return false;}
      if (busy) return false;
      const previous=state;busy=true;
      try{next=workflow.prepare(state,next,new Date().toISOString(),{canApprove,approvedBy:'Kantoor'});}catch(error){busy=false;message=error.message;render();return false;}
      if(optimistic){state=next;message='Verplaatsing opslaan…';render();}
      root.setAttribute('aria-busy','true');
      try {
        next={...next,taskSuggestions:Array.from(new Set([...(state.taskSuggestions||[]),...next.jobs.flatMap(j=>j.task.split(/[\n.!?]+/).map(t=>t.trim()).filter(t=>t.length>=3&&t.length<=500))])).slice(-2000),nextJobNumber:Math.max(state.nextJobNumber||1,...[...state.jobs,...next.jobs].map(j=>Number(j.number.slice(3))+1))};
        if (demo) localStorage.setItem(storageKey,JSON.stringify(next));
        else { const result=await request('PUT',{state:next,version,baseState}); version=result.version;next=result.state||next; }
        state=next;baseState=structuredClone(state); message='Opgeslagen'; return true;
      } catch(e) {
        if(optimistic)state=previous;
        message=(optimistic?'Niet opgeslagen; de bon is teruggezet. ':'')+e.message;
        if (e.conflict) { try {const latest=await request('GET');state=workflow.normalize(latest.state);baseState=structuredClone(state);version=latest.version;message=e.message+' De nieuwste planning is geladen; voer je wijziging opnieuw uit.';} catch { message='De planning is intussen gewijzigd. Vernieuw de pagina voordat je verdergaat.'; } }
        return false;
      } finally {busy=false;root.removeAttribute('aria-busy');render();}
    }
    async function refresh(manual=false) {
      if(demo||busy||dragging||root.querySelector('dialog[open]'))return;
      busy=true;
      try{const latest=await request('GET',undefined,config.api+'?since='+version);if(latest.state&&latest.version!==version){state=workflow.normalize(latest.state);baseState=structuredClone(state);version=latest.version;message='Planning bijgewerkt';render();}else if(manual){message='Planning is actueel';render();}}
      catch{message='Verbinding met de planning onderbroken. Vernieuw voordat je wijzigingen maakt.';render();}
      finally{busy=false;}
    }
    const refreshTimer=!demo?window.setInterval(()=>{if(!document.hidden)void refresh();},30000):null;
    const personName=id=>state.employees.find(e=>e.id===id)?.name || 'Nog toewijzen';
    const visible=j=>`${j.number} ${j.customer} ${j.machine} ${j.serial} ${j.task} ${j.notes} ${j.kind||''} ${j.invoiceReference||''} ${personName(j.employee)}`.toLowerCase().includes(search.toLowerCase());
    const personnel=()=>state.employees.filter(e=>(mode==='driver'?isDriver(e):e.role==='mechanic') && (!filter || e.id===filter));
    function card(j) {
      const info=mode==='driver'?j.transport:j;
      const time=info?.time||'',finish=endTime(time||'08:00',info?.duration||120),status=mode==='driver'?info?.state||j.status:j.status;
      const summary=[time,j.number,j.machine,j.customer,status,j.urgent?'Spoed':'',j.kind||'Klantreparatie',j.estimatedMinutes?'Richttijd '+spentTime(j.estimatedMinutes):''].filter(Boolean).join(' · ');
      return `<button type="button" draggable="${canEdit}" data-job="${j.id}" class="hf-job hf-kind-${KINDS.indexOf(j.kind||'Klantreparatie')} ${j.urgent?'hf-urgent':''} hf-status-${STATUSES.indexOf(j.status)} ${info?.state==='Afgeleverd'?'hf-done':''}" aria-label="Open ${esc(summary)}" title="${esc(summary)}"><span class="hf-job-line"><span class="hf-job-time">${esc(mode==='archive'?j.number:time)}</span> <strong>${j.urgent?'! ':''}${esc(j.machine)}${j.kind==='Voorraadtruck'?' · '+(j.estimatedMinutes?esc(spentTime(j.estimatedMinutes)):'richttijd nog invullen'):''}</strong><span class="hf-job-customer"> · ${esc(j.customer)}</span></span><span class="hf-job-meta" ${mode==='archive'?'':'hidden'}>${esc(j.number)} · ${esc(status)}${j.completedAt?' · '+esc(new Date(j.completedAt).toLocaleDateString('nl-NL',{timeZone:'Europe/Amsterdam'})):''}</span></button>`;
    }
    function dayHeading(date,index){
      const nav=index===0?'<button type="button" class="hf-day-prev" data-action="prev" aria-label="Vorige week" title="Vorige week">←</button>':index===6?'<button type="button" class="hf-day-next" data-action="next" aria-label="Volgende week" title="Volgende week">→</button>':'';
      return '<div class="hf-day '+(date===localDate(new Date())?'hf-today ':'')+(index===0?'hf-day-first':index===6?'hf-day-last':'')+'">'+nav+'<div class="hf-day-label"><span>'+new Date(date+'T12:00:00').toLocaleDateString('nl-NL',{weekday:'short'})+'</span><strong>'+pretty(date)+'</strong><small class="hf-holiday">'+calendar.dutchHolidays(Number(date.slice(0,4))).filter(h=>h.date===date).map(h=>esc(h.name)).join(' · ')+'</small></div></div>';
    }
    function colorLegend(){const statuses=[['Nieuw','#f3f5f7'],['Ingepland','#e7effa'],['Mee bezig','#def1e3'],['Wacht op onderdelen','#ffd09a'],['Wacht op goedkeuring','#f8edda'],['Te controleren','#eee6f6'],['On hold','#f9dddd']];const kinds=[['Klantreparatie','#4b7189'],['Verkooptruck','#8463b5'],['Voorraadtruck','#9b7943'],['Spoed !','#39ff14']];return '<div class="hf-color-legend" aria-label="Kleurlegenda werkplaats"><div><strong>Status</strong>'+statuses.map(([label,color])=>'<span><i style="background:'+color+'"></i>'+label+'</span>').join('')+'</div><div><strong>Soort bon</strong>'+kinds.map(([label,color])=>'<span><i class="hf-kind-swatch" style="background:'+color+'"></i>'+label+'</span>').join('')+'</div></div>';}
    function backlog(){const pool=state.jobs.filter(j=>!completed(j)&&(!j.employee||!j.date)&&visible(j));return '<section class="hf-backlog"><h2>Algemene werkbonnenbak</h2><p>Sleep een bon naar een monteur en dag. Voorraadklussen kunnen monteurs zelf oppakken.</p><div class="hf-pools">'+['Algemeen','Voorraadmachines'].map((label,index)=>'<section><h3>'+label+'</h3><button type="button" data-pool-create="'+(index===1?'stock':'general')+'">＋ Werkbon maken</button><div class="hf-backlog-cards" data-pool="'+(index===1?'stock':'general')+'">'+(pool.filter(j=>(j.kind==='Voorraadtruck')===(index===1)).map(card).join('')||'<p>Geen werkbonnen.</p>')+'</div></section>').join('')+'</div></section>';}
    function render() {
      if(config.isActive&&!config.isActive())return;
      let viewRoot=root.querySelector('.hf-view');
      if(!viewRoot){viewRoot=document.createElement('div');viewRoot.className='hf-view';root.replaceChildren(viewRoot);}
      if(mode==='archive'){renderArchive(viewRoot);return;}
      if(!root.querySelector('.hf-drag-week-nav')){const nav=document.createElement('div');nav.className='hf-drag-week-nav';nav.innerHTML='<button type="button" data-drag-week="-1">← Vorige week</button><button type="button" data-drag-week="1">Volgende week →</button>';nav.querySelectorAll('button').forEach(button=>button.onclick=e=>e.preventDefault());root.appendChild(nav);}
      const days=Array.from({length:7},(_,i)=>addDays(week,i));
      const people=personnel();
      if(mode==='driver'){renderTransport(viewRoot,days,people);if(dragging)root.querySelectorAll('[data-transport]').forEach(card=>{if(card.dataset.transport===dragging)card.classList.add('hf-drag-source');});return;}
      const jobs=state.jobs.filter(j=>!completed(j)).filter(visible).filter(j=>mode!=='driver' || (j.status==='Klaar voor transport' && j.transport));
      viewRoot.innerHTML=`<div class="hf-banner">${demo?'PROEFVERSIE · Voorbeeldgegevens · Alleen opgeslagen in deze browser':'WERKPLAATS · Gedeelde planning'}<span>Werkbonnen zonder prijzen</span></div>
      <header class="hf-heading"><div><div class="hf-eyebrow">HEFTRUCKS FRIESLAND / EIGEN WERKPLAATSPLANNING</div><h1>Werkplaatsplanning</h1><p>Plan het werk per monteur en draag het over aan de chauffeur.</p></div><button class="hf-primary" data-action="new">＋ Nieuwe werkbon</button></header>
      <div class="hf-summary"><div><strong>${state.jobs.filter(j=>!completed(j)&&j.status!=='Klaar voor transport').length}</strong> open werkbonnen</div><div><strong>${state.jobs.filter(j=>!j.deletedAt&&j.status==='Mee bezig').length}</strong> mee bezig</div><div><strong>${state.jobs.filter(j=>!j.deletedAt&&j.status.startsWith('Wachten')).length}</strong> wachten</div><div><strong>${state.jobs.filter(j=>!j.deletedAt&&j.status==='Werkbon-controle').length}</strong> te controleren</div></div>
      <div class="hf-toolbar"><div class="hf-tabs"><button data-action="workshop" aria-pressed="${mode==='workshop'}">▦ Werkplaatsplanning</button><button data-action="driver" aria-pressed="${mode==='driver'}">▰ Transportplanning</button></div><div class="hf-tools">${mode==='driver'?'<button data-action="print-trips">Ritlijst afdrukken</button>':''}${demo?'':'<button data-action="refresh">Vernieuwen</button>'}<button data-action="employees">Medewerkers</button><input aria-label="Zoek werkbonnen" id="hf-search" placeholder="Zoek klant, machine, bon…" value="${esc(search)}"><select id="hf-person" aria-label="Filter medewerker"><option value="">Alle ${mode==='driver'?'chauffeurs':'monteurs'}</option>${options(state.employees.filter(e=>e.role===(mode==='driver'?'driver':'mechanic')),filter)}</select></div></div>
      <div class="hf-weekbar"><div><button data-action="today">Deze week</button></div><h2>Week ${calendar.isoWeek(week).week} · ${pretty(days[0])} – ${pretty(days[6])} ${calendar.isoWeek(week).year}</h2><p>Klik op ＋ om een bon te plannen · sleep een bon om te verplaatsen</p></div>
      <div role="status" class="hf-message">${esc(message)}</div>
      ${mode==='workshop'?backlog()+colorLegend():''}<div class="hf-agenda-wrap"><div class="hf-agenda" style="--hf-rows:${people.length}"><div class="hf-corner">${mode==='driver'?'Chauffeur':'Monteur'}</div>${days.map(dayHeading).join('')}
      ${people.map(p=>`<div class="hf-person" data-employee="${p.id}" draggable="${canEdit}" tabindex="${canEdit?0:-1}" aria-label="${esc(p.name)} · sleep om volgorde te wijzigen"><span>${esc(p.name.slice(0,2).toUpperCase())}</span><strong>${esc(p.name)}</strong><small>${mode==='driver'?'Chauffeur':'Monteur'}</small></div>${days.map(d=>`<section class="hf-cell" data-date="${d}" data-person="${p.id}" aria-label="${esc(p.name)} ${d}">${jobs.filter(j=>(mode==='driver'?j.transport.driver:j.employee)===p.id && (mode==='driver'?j.transport.date:j.date)===d).sort((a,b)=>(mode==='driver'?a.transport.time:a.time).localeCompare(mode==='driver'?b.transport.time:b.time)).map(card).join('')}<button class="hf-add" data-create-date="${d}" data-create-person="${p.id}" aria-label="${mode==='driver'?'Transport plannen':'Nieuwe werkbon'} ${esc(p.name)} ${d}">＋ ${mode==='driver'?'Transport':'Werkbon'}</button></section>`).join('')}`).join('')}</div></div>
      ${!people.length?'<p class="hf-empty">Geen medewerkers in deze selectie. Voeg medewerkers toe of wijzig het filter.</p>':''}
      ${mode==='driver'?'<section class="hf-backlog"><h2>Gereed, transport nog invullen</h2><div class="hf-backlog-cards">'+state.jobs.filter(j=>!completed(j)&&j.status==='Klaar voor transport'&&!j.transport&&visible(j)).map(card).join('')+'</div></section>':''}`;
      if(!canEdit){viewRoot.querySelectorAll('[data-action="new"],[data-action="employees"],.hf-add').forEach(e=>e.remove());if(viewRoot.querySelector('.hf-weekbar p'))viewRoot.querySelector('.hf-weekbar p').textContent='Werkplaatstablet · open een bon voor voortgang en notities';viewRoot.querySelectorAll('.hf-backlog>p').forEach(p=>p.textContent='Open een voorraadbon om deze op te pakken.');const badge=document.createElement('strong');badge.className='hf-viewer-badge';badge.textContent='WERKPLAATS';viewRoot.querySelector('.hf-heading').appendChild(badge);}
      if(mode==='archive'){
        const done=state.jobs.filter(completed).filter(j=>!filter||j.employee===filter).filter(visible).sort((a,b)=>(b.completedAt||b.date).localeCompare(a.completedAt||a.date));
        viewRoot.querySelector('.hf-heading h1').textContent='Afgeronde werkbonnen';viewRoot.querySelector('.hf-heading p').textContent='Bewaarde werkbonnen, gekoppeld aan klant en machine.';
        viewRoot.querySelector('.hf-weekbar').remove();viewRoot.querySelector('.hf-agenda-wrap').outerHTML='<section class="hf-archive-list">'+(done.map(card).join('')||'<p>Geen afgeronde werkbonnen gevonden.</p>')+'</section>';viewRoot.querySelectorAll('.hf-backlog').forEach(el=>el.remove());
      }
      bind();
      const orderLink=document.createElement('a');orderLink.className='hf-order-link';orderLink.target='_top';orderLink.href='/werkplaats/bestellingen'+(demo&&!canEdit?'?tablet=1':'');orderLink.textContent='Onderdelen bestellen';viewRoot.querySelector('.hf-tabs').appendChild(orderLink);
      if(dragging)root.querySelectorAll('[data-job]').forEach(card=>{if(card.dataset.job===dragging)card.classList.add('hf-drag-source');});
      const blank=document.createElement('a');blank.href='/werkplaats/werkbon/print';blank.target='_blank';blank.rel='noopener';blank.className='hf-order-link';blank.textContent='Lege werkbon afdrukken';viewRoot.querySelector('.hf-tabs').appendChild(blank);
    }
    function renderArchive(viewRoot){
      const dateOf=workflow.documentDate||((j)=>j.completedAt?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(j.completedAt)):j.date||'');
      const years=Array.from(new Set([String(new Date().getFullYear()),...state.jobs.map(j=>dateOf(j).slice(0,4)).filter(Boolean)])).sort().reverse();
      const fallback=(jobs,f)=>jobs.filter(j=>{if(f.status==='deleted'?!j.deletedAt:!!j.deletedAt)return false;const date=dateOf(j);return (!f.year||date.startsWith(f.year))&&(!f.month||date.slice(5,7)===f.month)&&(!f.date||date===f.date)&&(!f.status||f.status==='all'||f.status==='deleted'||(f.status==='completed'?completed(j):f.status==='review'?j.status==='Werkbon-controle':!completed(j)))&&[j.number,j.customer,j.machine,j.task,j.invoiceReference||''].join(' ').toLowerCase().includes(f.query.toLowerCase());}).sort((a,b)=>dateOf(b).localeCompare(dateOf(a)));
      const jobs=(workflow.documents||fallback)(state.jobs,archiveFilters);
      const months=['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
      const groups=new Map();for(const j of jobs){const day=dateOf(j),year=day.slice(0,4)||'Zonder datum',month=day.slice(5,7)||'';if(!groups.has(year))groups.set(year,new Map());const byMonth=groups.get(year);if(!byMonth.has(month))byMonth.set(month,[]);byMonth.get(month).push(j);}
      const expanded=Object.values(archiveFilters).some(v=>v&&v!=='all');
      const record=j=>'<button class="hf-document-record" data-document="'+j.id+'" aria-label="Open werkbon '+esc(j.number)+'"><span>'+esc(dateOf(j)?new Date(dateOf(j)+'T12:00:00').toLocaleDateString('nl-NL'):'Nog te plannen')+'</span><strong>'+esc(j.number)+'</strong><span><strong>'+esc(j.customer)+'</strong><small>'+esc(j.machine)+'</small>'+(j.invoiceReference?'<small>Factuur '+esc(j.invoiceReference)+'</small>':'')+'</span><span class="hf-document-status">'+esc(j.status)+'</span><span>'+esc(j.actualMinutes===undefined?'—':spentTime(j.actualMinutes))+'</span></button>';
      const archiveGroups=jobs.length?Array.from(groups,([year,byMonth])=>'<details class="hf-document-folder" '+(expanded?'open':'')+'><summary>'+esc(year)+' · '+Array.from(byMonth.values()).reduce((n,list)=>n+list.length,0)+' werkbonnen</summary>'+Array.from(byMonth,([month,list])=>'<details class="hf-document-folder" '+(expanded?'open':'')+'><summary>'+esc(month?months[Number(month)-1]:'Zonder datum')+' · '+list.length+' werkbonnen</summary>'+list.map(record).join('')+'</details>').join('')+'</details>').join(''):'<p class="hf-empty">Geen werkbonnen gevonden voor deze selectie.</p>';
      viewRoot.innerHTML=`<header class="hf-document-heading"><div><div class="hf-eyebrow">WERK & DOSSIERS</div><h1>${archiveFilters.status==='deleted'?'Archiefbak werkbonnen':'Werkbonnen'}</h1><p>Zoek bewaarde werkbonnen op datum, maand en jaar. Afgeronde bonnen staan op afsluitdatum, open bonnen op plandatum.</p></div><div><button class="hf-order-link" type="button" data-toggle-bin>${archiveFilters.status==='deleted'?'Terug naar werkbonnen':'Archiefbak ('+state.jobs.filter(j=>j.deletedAt).length+')'}</button><a class="hf-order-link" href="/werkplaats">Werkplaatsplanning</a><a class="hf-order-link" href="/werkplaats/werkbon/print" target="_blank" rel="noopener">Lege werkbon afdrukken</a></div></header>
      <form class="hf-document-filters"><label>Jaar<select name="year"><option value="">Alle jaren</option>${options(years,archiveFilters.year)}</select></label><label>Maand<select name="month"><option value="">Alle maanden</option>${options(months.map((name,index)=>({id:String(index+1).padStart(2,'0'),name})),archiveFilters.month)}</select></label>${field('Datum','date',archiveFilters.date,'date')}<label>Status<select name="status">${options([{id:'all',name:'Alle werkbonnen'},{id:'open',name:'Open'},{id:'review',name:'Te controleren'},{id:'completed',name:'Afgerond'},{id:'cancelled',name:'Geannuleerd'},{id:'deleted',name:'Archiefbak'}],archiveFilters.status)}</select></label>${field('Zoeken','query',archiveFilters.query,'search','placeholder="Werkbon, klant, machine, factuur…"')}<button class="hf-primary" type="submit">Zoeken</button><button type="button" data-clear-documents>Wissen</button></form>
      <div class="hf-document-count" role="status">${jobs.length} werkbon${jobs.length===1?'':'nen'}${message?' · '+esc(message):''}</div><div class="hf-document-list"><div class="hf-document-columns"><span>Datum</span><span>Werkbon</span><span>Klant / machine</span><span>Status</span><span>Gewerkt</span></div>${archiveGroups}</div>`;
      viewRoot.querySelector('[data-toggle-bin]').onclick=()=>{archiveFilters={year:'',month:'',date:'',status:archiveFilters.status==='deleted'?'all':'deleted',query:''};render();};
      const form=viewRoot.querySelector('form');form.onsubmit=e=>{e.preventDefault();archiveFilters=Object.fromEntries(new FormData(form));render();};form.querySelectorAll('select,input[type=date]').forEach(input=>input.onchange=()=>form.requestSubmit());viewRoot.querySelector('[data-clear-documents]').onclick=()=>{archiveFilters={year:'',month:'',date:'',status:'all',query:''};render();};viewRoot.querySelectorAll('[data-document]').forEach(button=>button.onclick=()=>viewJob(state.jobs.find(j=>j.id===button.dataset.document)));
    }

    function officePanel(job){
      if(job.status==='Geannuleerd')return '<section class="hf-office"><h3>Geannuleerd</h3><p>'+esc(job.cancellationReason)+' · '+esc(job.cancelledBy)+' · '+esc(job.cancelledAt?new Date(job.cancelledAt).toLocaleString('nl-NL'):'')+'</p></section>';
      if(!canApprove)return '';
      if(job.status==='Werkbon-controle')return '<section class="hf-office"><h3>Laatste controle door kantoor</h3><p>Controleer de werkzaamheden, uren, onderdelen en check-up. Na goedkeuring wordt de werkbon afgesloten en staat de transportbon klaar in de transportbak.</p><p class="hf-office-error" role="alert"></p><button type="button" data-approve-job>Controle goed · werkbon afsluiten</button></section>';
      if(!['Afgerond','Klaar voor transport'].includes(job.status))return job.invoicePaidAt?'<section class="hf-office"><h3>Eerder betaalde factuur</h3><p>'+esc(job.invoiceReference)+' · Betaald op '+esc(new Date(job.invoicePaidAt).toLocaleString('nl-NL'))+'. De technische vrijgave vervalt bij heropening; betaling blijft bewaard.</p></section>':'';
      return '<section class="hf-office"><h3>Facturatie en vrijgave transport</h3><p>Print de werkbon voor facturatie. Leg hier vast wanneer de factuur via jullie facturatiesysteem is verstuurd en betaald.</p><form class="hf-office-form">'+field('Factuurnummer / referentie','invoiceReference',job.invoiceReference||'','text','maxlength="180"')+'<label class="hf-flag"><input type="checkbox" name="invoiceSent" '+(job.invoiceSentAt?'checked':'')+'>Factuur verstuurd</label><label class="hf-flag"><input type="checkbox" name="invoicePaid" '+(job.invoicePaidAt?'checked':'')+'>Factuur betaald · transport vrijgeven</label><p class="hf-office-error" role="alert"></p><button type="submit" class="hf-primary">Facturatie bijwerken</button></form></section>';
    }
    function bindOffice(d,job){
      const approve=d.querySelector('[data-approve-job]');
      if(approve)approve.onclick=async()=>{if(busy||!canApprove)return;approve.disabled=true;const changed={...job,status:'Afgerond'};if(await commit({...state,jobs:state.jobs.map(j=>j.id===job.id?changed:j)})){d.close();viewJob(state.jobs.find(j=>j.id===job.id));}else{approve.disabled=false;d.querySelector('.hf-office-error').textContent=message;}};
      const form=d.querySelector('.hf-office-form');
      if(form)form.onsubmit=async e=>{e.preventDefault();if(busy||!canApprove)return;const f=new FormData(form),now=new Date().toISOString(),changed={...job,invoiceReference:String(f.get('invoiceReference')||'').trim()};if(f.has('invoiceSent'))changed.invoiceSentAt=job.invoiceSentAt||now;else delete changed.invoiceSentAt;if(f.has('invoicePaid'))changed.invoicePaidAt=job.invoicePaidAt||now;else delete changed.invoicePaidAt;const button=form.querySelector('[type=submit]');button.disabled=true;if(await commit({...state,jobs:state.jobs.map(j=>j.id===job.id?changed:j)})){d.close();viewJob(state.jobs.find(j=>j.id===job.id));}else{button.disabled=false;d.querySelector('.hf-office-error').textContent=message;}};
    }
    function transportCard(ticket){
      const release=workflow.release(ticket,state.jobs),driver=state.employees.find(e=>e.id===ticket.driver)?.name||'Nog niet ingepland';
      const summary=[ticket.title,ticket.customer,ticket.appointmentTime?'Afspraak '+ticket.appointmentTime:'',ticket.state,release.label,driver].filter(Boolean).join(' · ');
      return '<button type="button" data-transport="'+esc(ticket.id)+'" class="hf-job hf-transport-card '+(!release.allowed?'hf-transport-blocked':'')+' '+(ticket.state==='Afgeleverd'?'hf-done':'')+'" aria-label="Open transport '+esc(summary)+'" title="'+esc(summary)+'"><span class="hf-job-line"><strong>'+esc(ticket.title)+'</strong>'+(ticket.appointmentTime?'<span> · Afspraak '+esc(ticket.appointmentTime)+'</span>':'')+'</span><small>'+esc(ticket.driver?ticket.state:release.label)+'</small></button>';
    }
    function renderTransport(viewRoot,days,people){
      const matches=t=>[t.title,t.customer,t.machine,t.pickup,t.address,t.instructions].join(' ').toLowerCase().includes(search.toLowerCase());
      const tickets=(state.transports||[]).filter(t=>!t.deletedAt&&matches(t)),unplanned=tickets.filter(t=>!t.driver&&!t.date);
      viewRoot.innerHTML=`<div class="hf-banner">${demo?'PROEFVERSIE · Alleen in deze browser opgeslagen':'TRANSPORT · Gedeelde planning'}<span>Plannen op dag en volgorde</span></div><header class="hf-heading"><div><div class="hf-eyebrow">HEFTRUCKS FRIESLAND</div><h1>Transportplanning</h1><p>Bereid transport voor en sleep vrijgegeven bonnen naar een chauffeur en dag.</p></div>${canEdit?'<button class="hf-primary" data-action="new-transport">＋ Losse transportbon</button>':''}</header>
      <div class="hf-toolbar"><div class="hf-tabs"><button data-action="workshop">▦ Werkplaatsplanning</button><button aria-pressed="true" data-action="driver">▰ Transportplanning</button></div><div class="hf-tools">${mode==='driver'?'<button data-action="print-trips">Ritlijst afdrukken</button>':''}${demo?'':'<button data-action="refresh">Vernieuwen</button>'}${canEdit?'<button data-action="employees">Medewerkers</button>':''}<input id="hf-search" aria-label="Zoek transportbonnen" placeholder="Zoek transport, klant, adres…" value="${esc(search)}"><select id="hf-person" aria-label="Filter chauffeur"><option value="">Alle chauffeurs</option>${options(state.employees.filter(isDriver),filter)}</select></div></div>
      <div class="hf-weekbar"><div><button data-action="today">Deze week</button></div><h2>Week ${calendar.isoWeek(week).week} · ${pretty(days[0])} – ${pretty(days[6])}</h2><p>De volgorde in het dagvak is de ritvolgorde. Een afgesproken tijd is alleen een extra aanwijzing.</p></div><p role="status" class="hf-message">${esc(message)}</p>
      <section class="hf-backlog"><h2>Transportvergaarbakken</h2><div class="hf-pools">${['Werkbonnen / afleveringen','Verhuur / brengen & ophalen','Inkoop / losse transporten'].map((label,index)=>'<section><h3>'+label+'</h3><div class="hf-backlog-cards" data-pool="'+(['transport-workshop','transport-rental','transport-purchase'][index])+'">'+(unplanned.filter(t=>(t.jobId?0:t.rentalId?1:2)===index).map(transportCard).join('')||'<p>Geen transportbonnen.</p>')+'</div></section>').join('')}</div></section>
      <div class="hf-agenda-wrap"><div class="hf-agenda" style="--hf-rows:${people.length}"><div class="hf-corner">Chauffeur</div>${days.map(dayHeading).join('')}${people.map(person=>'<div class="hf-person" data-employee="'+person.id+'" draggable="'+canEdit+'" tabindex="0"><strong>'+esc(person.name)+'</strong></div>'+days.map(date=>'<section class="hf-cell" data-person="'+person.id+'" data-date="'+date+'" aria-label="'+esc(person.name)+' '+date+'">'+tickets.filter(t=>t.driver===person.id&&t.date===date).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)).map(transportCard).join('')+(canEdit?'<button class="hf-add" data-create-date="'+date+'" data-create-person="'+person.id+'">＋ Transport</button>':'')+'</section>').join('')).join('')}</div></div>${!people.length?'<p>Voeg Harm of een andere chauffeur toe via Medewerkers. Een monteur kan daar ook als chauffeur beschikbaar worden gemaakt.</p>':''}`;
      bind();
      root.querySelectorAll('[data-transport]').forEach(el=>{el.draggable=false;el.onclick=()=>{if(Date.now()<suppressClickUntil)return;transportEdit(state.transports.find(t=>t.id===el.dataset.transport));};el.onpointerdown=e=>beginPointerDrag(e,el);});
    }
    async function dropTransport(id,element,beforeId){
      if(busy||!canEdit)return;const ticket=state.transports.find(t=>t.id===id);if(!ticket)return;
      try{
        let next;if(element.dataset.pool){const wanted=ticket.jobId?'transport-workshop':ticket.rentalId?'transport-rental':'transport-purchase';if(element.dataset.pool!==wanted)throw new Error('Zet deze transportbon terug in zijn eigen transportbak.');next=workflow.moveTransport(state,id,{driver:'',date:'',position:ticket.position});}
        else{
          const siblings=state.transports.filter(t=>!t.deletedAt&&t.id!==id&&t.driver===element.dataset.person&&t.date===element.dataset.date).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));const index=siblings.findIndex(t=>t.id===beforeId);if(index<0)siblings.push(ticket);else siblings.splice(index,0,ticket);
          next=workflow.moveTransport(state,id,{driver:element.dataset.person,date:element.dataset.date,position:index<0?siblings.length-1:index});next={...next,transports:next.transports.map(t=>{const position=siblings.findIndex(s=>s.id===t.id);return position<0?t:{...t,position};})};
        }
        await commit(next,true);
      }catch(error){message=error.message;render();}
    }
    function transportEdit(existing,preset={}){
      if(existing?.deletedAt){const d=dialog('<h2>Transportbon verwijderd</h2><p>Deze bon staat niet meer in de planning of transportbakken. De gekoppelde werkbon blijft bewaard.</p>'+(canEdit?'<button data-restore-transport>Transportbon terugzetten</button>':'')+'<button data-close>Sluiten</button>');const restore=d.querySelector('[data-restore-transport]');if(restore)restore.onclick=async()=>{if(busy)return;restore.disabled=true;const restored={...existing,deletedAt:undefined,driver:'',date:'',state:'Nieuw'};if(await commit({...state,transports:state.transports.map(t=>t.id===existing.id?restored:t)})){d.close();transportEdit(state.transports.find(t=>t.id===existing.id));}else{restore.disabled=false;const error=document.createElement('p');error.setAttribute('role','alert');error.textContent=message;d.appendChild(error);}};return;}

      if(!existing&&!canEdit)return;
      const ticket={id:uid(),kind:'Inkoop ophalen',title:'',customer:'',machine:'',pickup:'',address:'Eigen werkplaats',contact:'',instructions:'',driver:'',date:'',appointmentTime:'',position:0,state:'Nieuw',confirmation:'',...existing,...preset},release=workflow.release(ticket,state.jobs);
      if(!canEdit){const d=dialog('<h2>'+esc(ticket.title)+'</h2><p><strong>'+esc(release.label)+'</strong></p><p>'+esc(ticket.customer)+' · '+esc(ticket.machine)+'</p><h3>Ophalen</h3><p>'+esc(ticket.pickup)+'</p><h3>Afleveren</h3><p>'+esc(ticket.address)+'</p><p>Contact: '+esc(ticket.contact)+'</p><p>Afgesproken tijd: '+esc(ticket.appointmentTime||'Geen vaste tijd')+'</p><p class="hf-readable">'+esc(ticket.instructions)+'</p><button data-print-transport>Transportbon afdrukken</button><button data-close>Sluiten</button>');d.querySelector('[data-print-transport]').onclick=()=>printTransportTicket(ticket);return;}
      const d=dialog(`<h2>${existing?'Transportbon':'Nieuwe transportbon'}</h2><p class="hf-release ${release.allowed?'is-ready':''}">${esc(release.label)}</p><form class="hf-transport-form"><div class="hf-fields">${field('Omschrijving','title',ticket.title,'text','required maxlength="300" '+((ticket.jobId||ticket.rentalId)?'readonly':''))}${!existing?'<label>Soort transport<select name="kind">'+options(['Inkoop ophalen','Overig'],ticket.kind)+'</select></label>':''}${field('Klant / leverancier','customer',ticket.customer,'text',(ticket.jobId||ticket.rentalId)?'readonly':'')}${field('Machine','machine',ticket.machine,'text',(ticket.jobId||ticket.rentalId)?'readonly':'')}${field('Ophaaladres','pickup',ticket.pickup)}${field('Afleveradres','address',ticket.address)}${field('Contactpersoon / telefoon','contact',ticket.contact)}<label>Chauffeur<select name="driver"><option value="">Nog niet inplannen</option>${options(state.employees.filter(isDriver),ticket.driver)}</select></label>${field('Transportdatum','date',ticket.date,'date')}${field('Afgesproken tijd (optioneel)','appointmentTime',ticket.appointmentTime,'time')}<label>Status<select name="state">${options(['Nieuw','Gepland','Onderweg','Afgeleverd'],ticket.state)}</select></label></div><label>Voorbereiding / laad- en afleverinstructies<textarea name="instructions" rows="5" maxlength="6000">${esc(ticket.instructions)}</textarea></label><label>Afleverbevestiging<textarea name="confirmation" rows="2" maxlength="6000">${esc(ticket.confirmation)}</textarea></label>${!release.allowed?'<p>Voorbereiding kan al worden opgeslagen. Inplannen kan pas na de laatste controle en betaling.</p>':''}<p class="hf-form-error" role="alert"></p><div class="hf-form-actions">${ticket.jobId?'<button type="button" data-open-linked-job>Werkbon openen</button>':''}${ticket.rentalId?'<a href="/verhuur?phase=all#rental-'+esc(ticket.rentalId)+'">Verhuur openen</a>':''}${existing?'<button type="button" data-delete-transport>Transportbon verwijderen</button><button type="button" data-print-transport>Transportbon afdrukken</button>':''}<button type="button" data-close>Sluiten</button><button type="submit" class="hf-primary">Transportbon opslaan</button></div></form>`);
      const open=d.querySelector('[data-open-linked-job]');if(open)open.onclick=()=>{const job=state.jobs.find(j=>j.id===ticket.jobId);if(job){d.close();viewJob(job);}};
      const remove=d.querySelector('[data-delete-transport]');if(remove)remove.onclick=async()=>{if(busy||!canEdit)return;if(!window.confirm('Transportbon verwijderen? De bon verdwijnt uit de planning en transportbakken. Een gekoppelde werkbon blijft bewaard.'))return;remove.disabled=true;const next={...state,transports:state.transports.map(t=>t.id===ticket.id?{...t,deletedAt:new Date().toISOString()}:t)};if(await commit(next)){message='Transportbon verwijderd';d.close();render();}else{remove.disabled=false;d.querySelector('.hf-form-error').textContent=message;}};
      const print=d.querySelector('[data-print-transport]');if(print)print.onclick=()=>printTransportTicket(ticket);
      const form=d.querySelector('form');form.onsubmit=async e=>{e.preventDefault();if(busy)return;const f=new FormData(form),val=n=>String(f.get(n)||'').trim(),updated={...ticket,title:val('title'),kind:existing?ticket.kind:val('kind'),customer:val('customer'),machine:val('machine'),pickup:val('pickup'),address:val('address'),contact:val('contact'),driver:val('driver'),date:val('date'),appointmentTime:val('appointmentTime'),state:val('state'),instructions:val('instructions'),confirmation:val('confirmation')};if(updated.driver&&updated.date&&updated.state==='Nieuw')updated.state='Gepland';if(!updated.driver&&!updated.date)updated.state='Nieuw';if(updated.driver!==ticket.driver||updated.date!==ticket.date)updated.position=Math.max(0,...state.transports.filter(t=>t.driver===updated.driver&&t.date===updated.date).map(t=>t.position+1));const button=form.querySelector('[type=submit]');button.disabled=true;if(await commit({...state,transports:existing?state.transports.map(t=>t.id===ticket.id?updated:t):[...state.transports,updated]}))d.close();else{button.disabled=false;d.querySelector('.hf-form-error').textContent=message;}};
    }
    async function openPdf(payload){
      const preview=window.open('about:blank','_blank');
      if(!preview){message='Sta pop-ups toe om de PDF te openen.';render();return;}
      preview.document.body.textContent='Afdruk voorbereiden…';
      try{const token=document.cookie.split('; ').find(c=>c.startsWith('ks_csrf='))?.split('=').slice(1).join('=');
        const response=await fetch('/api/werkplaats/print',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'x-csrf-token':decodeURIComponent(token)}:{})},body:JSON.stringify(payload)});
        if(!response.ok){const result=await response.json();throw new Error(result.message||'Afdruk maken is niet gelukt.');}
        const url=URL.createObjectURL(await response.blob());preview.location.replace(url);setTimeout(()=>URL.revokeObjectURL(url),300000);
      }catch(error){preview.close();message=error.message;render();}
    }
    function printableTransport(t){return {...t,driver:state.employees.find(e=>e.id===t.driver)?.name||'',number:state.jobs.find(j=>j.id===t.jobId)?.number||''};}
    function printTransportTicket(ticket){void openPdf({type:'transport',item:printableTransport(ticket)});}
    function printTrips(){
      const end=addDays(week,6),tickets=state.transports.filter(t=>!t.deletedAt&&t.driver&&t.date>=week&&t.date<=end&&(!filter||t.driver===filter)&&[t.title,t.customer,t.machine,t.pickup,t.address,t.instructions].join(' ').toLowerCase().includes(search.toLowerCase()));
      if(!tickets.length){message='Geen geplande ritten in deze selectie.';render();return;}
      const d=dialog('<h2>Ritlijst afdrukken</h2><p>Kies een dag. De gekozen chauffeur en zoekfilter uit de planning worden meegenomen.</p><form><label>Dag<select name="tripDate"><option value="">Hele zichtbare week</option>'+Array.from(new Set(tickets.map(t=>t.date))).sort().map(date=>'<option value="'+date+'">'+pretty(date)+'</option>').join('')+'</select></label><div class="hf-form-actions"><button type="button" data-close>Sluiten</button><button type="submit" class="hf-primary">Ritlijst openen</button></div></form>');
      d.querySelector('form').onsubmit=e=>{e.preventDefault();const date=d.querySelector('[name="tripDate"]').value;void openPdf({type:'trips',items:tickets.filter(t=>!date||t.date===date).map(printableTransport)});d.close();};
    }

    function bind() {
      root.querySelectorAll('[data-employee]').forEach(el=>{
        el.ondragstart=e=>{if(!canEdit||busy){e.preventDefault();return;}e.dataTransfer.setData('text/employee',el.dataset.employee);};el.ondragover=e=>{if(canEdit)e.preventDefault();};
        el.ondrop=async e=>{e.preventDefault();const id=e.dataTransfer.getData('text/employee');if(!canEdit||busy||!id||id===el.dataset.employee)return;const employees=[...state.employees],from=employees.findIndex(p=>p.id===id),to=employees.findIndex(p=>p.id===el.dataset.employee);if(from<0||to<0)return;const [employee]=employees.splice(from,1);employees.splice(to,0,employee);await commit({...state,employees});};
        el.onkeydown=async e=>{if(!canEdit||!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const employees=[...state.employees],from=employees.findIndex(p=>p.id===el.dataset.employee),to=from+(e.key==='ArrowUp'?-1:1);if(to<0||to>=employees.length)return;[employees[from],employees[to]]=[employees[to],employees[from]];await commit({...state,employees});};
      });
      root.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>{
        if(Date.now()<suppressClickUntil)return;
        const action=el.dataset.action;
        if(action==='new')edit();
        if(action==='new-transport')transportEdit();
        if(action==='print-trips')printTrips();
        if(action==='employees')employeesDialog();
        if(action==='refresh')void refresh(true);
        if(['prev','next','today'].includes(action)){week=action==='today'?weekStart(localDate(new Date())):addDays(week,action==='prev'?-7:7);render();}
        if(['workshop','driver'].includes(action)){if(config.onModeChange){config.onModeChange(action);return;}mode=action;filter='';render();}
      });
      root.querySelector('#hf-person').onchange=e=>{filter=e.target.value;render();};
      root.querySelector('#hf-search').onchange=e=>{search=e.target.value;render();};
      root.querySelector('#hf-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search=e.target.value;render();}};
      root.querySelectorAll('[data-job]').forEach(el=>{
        el.onclick=()=>{if(Date.now()<suppressClickUntil)return;edit(state.jobs.find(j=>j.id===el.dataset.job));};
        el.draggable=false;
        el.onpointerdown=e=>{if(!completed(state.jobs.find(j=>j.id===el.dataset.job)))beginPointerDrag(e,el);};
      });
      root.querySelectorAll('[data-create-date]').forEach(el=>el.onclick=()=>{
        if(mode==='driver')transportPicker(el.dataset.createDate,el.dataset.createPerson);
        else edit(null,{date:el.dataset.createDate,employee:el.dataset.createPerson,status:'Ingepland'});
      });
    }

    function beginPointerDrag(e,el){
      if(!canEdit||busy||mode==='archive'||e.button!==0)return;
      const id=el.dataset.job||el.dataset.transport,transportDrag=Boolean(el.dataset.transport),rect=el.getBoundingClientRect(),startX=e.clientX,startY=e.clientY;
      let x=startX,y=startY,active=false,frame=0,ghost=null,slot=null,cell=null,transportBeforeId=null,hoverDirection=0,hoverSince=0,lastWeekSwitch=0;
      stopPointerDrag?.();
      const move=ev=>{if(ev.pointerId!==e.pointerId)return;x=ev.clientX;y=ev.clientY;if(!active&&Math.hypot(x-startX,y-startY)>=5){active=true;dragging=id;root.dataset.dragging='true';ghost=el.cloneNode(true);ghost.removeAttribute('data-job');ghost.removeAttribute('data-transport');ghost.classList.add('hf-pointer-ghost');ghost.style.width=rect.width+'px';ghost.style.height=rect.height+'px';root.appendChild(ghost);el.classList.add('hf-drag-source');slot=document.createElement('div');slot.className='hf-drop-slot';slot.style.height=rect.height+'px';slot.textContent='Hier neerzetten';frame=requestAnimationFrame(tick);}if(active)ev.preventDefault();};
      const tick=()=>{
        if(!active)return;
        ghost.style.transform='translate3d('+(x-(startX-rect.left))+'px,'+(y-(startY-rect.top))+'px,0) rotate(-3deg)';
        const over=document.elementFromPoint(x,y)?.closest('.hf-cell,[data-pool]');
        const next=over&&root.contains(over)?over:null;
        if(next!==cell){transportBeforeId=null;cell?.classList.remove('hf-over');cell=next;if(cell){cell.classList.add('hf-over');cell.insertBefore(slot,cell.querySelector('.hf-add'));}else slot.remove();}if(cell&&transportDrag){const before=document.elementFromPoint(x,y)?.closest('[data-transport]'),slotRect=slot.getBoundingClientRect();if(before&&before.dataset.transport!==id&&cell.contains(before)){transportBeforeId=before.dataset.transport;cell.insertBefore(slot,before);}else if(y<slotRect.top||y>slotRect.bottom){transportBeforeId=null;cell.insertBefore(slot,cell.querySelector('.hf-add'));}}
        if(y>innerHeight-60)window.scrollBy(0,12);else if(y<60)window.scrollBy(0,-12);
        const scroller=root.querySelector('.hf-agenda-wrap'),r=scroller?.getBoundingClientRect();if(r&&y>r.top&&y<r.bottom){if(x>r.right-35)scroller.scrollLeft+=12;else if(x<r.left+35)scroller.scrollLeft-=12;}
        const pointerTarget=document.elementFromPoint(x,y),weekButton=pointerTarget?.closest('[data-drag-week],[data-action="prev"],[data-action="next"]');
        let direction=weekButton?(Number(weekButton.dataset.dragWeek)||(weekButton.dataset.action==='prev'?-1:1)):0;
        if(!direction&&r&&y>r.top&&y<r.bottom){if(x>r.right-24&&scroller.scrollLeft+scroller.clientWidth>=scroller.scrollWidth-2)direction=1;else if(x<r.left+24&&scroller.scrollLeft<=2)direction=-1;}
        const now=Date.now();if(direction){if(direction!==hoverDirection){hoverDirection=direction;hoverSince=now;}if(now-hoverSince>=650&&now-lastWeekSwitch>=900){week=addDays(week,direction*7);lastWeekSwitch=now;hoverSince=now;transportBeforeId=null;cell?.classList.remove('hf-over');cell=null;slot.remove();message='Week '+calendar.isoWeek(week).week+' · sleep de bon naar de gewenste dag';render();}}else{hoverDirection=0;hoverSince=0;}
        frame=requestAnimationFrame(tick);
      };
      const cleanup=()=>{cancelAnimationFrame(frame);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',key);window.removeEventListener('blur',cancel);ghost?.remove();slot?.remove();cell?.classList.remove('hf-over');el.classList.remove('hf-drag-source');root.querySelectorAll('.hf-drag-source').forEach(card=>card.classList.remove('hf-drag-source'));delete root.dataset.dragging;dragging=null;stopPointerDrag=null;};
      const cancel=()=>{if(active)suppressClickUntil=Date.now()+350;active=false;cleanup();};
      const key=ev=>{if(ev.key==='Escape')cancel();};
      const up=ev=>{if(ev.pointerId!==e.pointerId)return;const pointerHit=document.elementFromPoint(ev.clientX,ev.clientY),beforeTransportId=transportBeforeId||pointerHit?.closest("[data-transport]")?.dataset.transport,weekDrop=pointerHit?.closest("[data-drag-week]"),hit=pointerHit?.closest(".hf-cell,[data-pool]"),destination=hit&&root.contains(hit)?hit:null,wasActive=active;if(active){suppressClickUntil=Date.now()+350;ev.preventDefault();}active=false;cleanup();if(wasActive&&weekDrop){const item=transportDrag?state.transports.find(t=>t.id===id):state.jobs.find(j=>j.id===id),person=transportDrag?item?.driver:item?.employee,target=weekCarryDestination(transportDrag?item?.date:item?.date,week,Number(weekDrop.dataset.dragWeek),lastWeekSwitch>0);week=target.week;render();if(person){const destination={dataset:{date:target.date,person}};if(transportDrag)void dropTransport(id,destination);else void dropJob(id,destination);}else{message='Week '+calendar.isoWeek(week).week+' · sleep de bon vanuit de bak naar een medewerker en dag';render();}return;}if(wasActive&&destination){if(transportDrag)void dropTransport(id,destination,beforeTransportId);else void dropJob(id,destination);}};
      stopPointerDrag=cancel;document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('keydown',key);window.addEventListener('blur',cancel);
    }
    async function dropJob(id,el){
      if(busy)return;const old=state.jobs.find(j=>j.id===id);if(!old)return;
      if(el.dataset.pool){try{await commit(workflow.returnJob(state,id,el.dataset.pool),true);}catch(error){message=error.message;render();}return;}
      if(mode==='driver'&&!old.transport){edit(old,{}, {date:el.dataset.date,driver:el.dataset.person});return;}
      if(mode==='driver'&&old.transport.state==='Afgeleverd'){message='Een afgeleverde rit kan niet worden verplaatst.';render();return;}
      const next=structuredClone(old);
      if(mode==='driver'){next.transport.date=el.dataset.date;next.transport.driver=el.dataset.person;}
      else{next.date=el.dataset.date;next.employee=el.dataset.person;if(next.status==='Nieuw')next.status='Ingepland';if(!old.employee||!old.date){for(let start=8*60;start+next.duration<=1440;start+=15){next.time=String(Math.floor(start/60)).padStart(2,'0')+':'+String(start%60).padStart(2,'0');if(!collision(state.jobs,next,'workshop'))break;}}}
      if(JSON.stringify(next)===JSON.stringify(old))return;
      if(collision(state.jobs,next,mode==='driver'?'driver':'workshop')){message='Deze medewerker heeft op dat tijdstip al een bon. Open de bon en kies een andere begintijd.';render();return;}
      const saving=commit({...state,jobs:state.jobs.map(j=>j.id===id?next:j)},true);
      root.querySelectorAll('[data-job]').forEach(card=>{if(card.dataset.job===id)card.animate([{transform:'rotate(-3deg) scale(1.03)'},{transform:'none'}],{duration:170});});await saving;
    }
    function dialog(html) {
      const previous=document.activeElement;
      const d=document.createElement('dialog');d.className='hf-dialog';d.innerHTML=html;root.appendChild(d);
      if(dialogCount===0){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}dialogCount++;
      d.showModal();
      d.addEventListener('close',()=>{d.remove();dialogCount=Math.max(0,dialogCount-1);if(dialogCount===0)document.body.style.overflow=previousOverflow;if(previous?.isConnected)previous.focus();});
      d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());return d;
    }
    function transportPicker(date,driver){const tickets=state.transports.filter(t=>!t.deletedAt&&!t.driver&&workflow.release(t,state.jobs).allowed);const d=dialog('<h2>Transport plannen</h2>'+tickets.map(t=>'<button class="hf-pick" data-pick-transport="'+esc(t.id)+'">'+esc(t.title)+'</button>').join('')+(tickets.length?'':'<p>Er zijn geen vrijgegeven transportbonnen in de bak.</p>')+'<button data-close>Sluiten</button>');d.querySelectorAll('[data-pick-transport]').forEach(button=>button.onclick=()=>{const ticket=state.transports.find(t=>t.id===button.dataset.pickTransport);d.close();transportEdit(ticket,{date,driver});});}
    function employeesDialog() {
      const d=dialog(`<h2>Medewerker toevoegen</h2><form>${field('Naam','name','','text','required maxlength="100" autofocus')}<label>Functie<select name="role"><option value="mechanic">Monteur</option><option value="driver">Chauffeur</option></select></label><label class="hf-flag"><input type="checkbox" name="canDrive">Ook beschikbaar als chauffeur</label><p class="hf-form-error" role="alert"></p><div class="hf-form-actions"><button type="button" data-close>Sluiten</button><button class="hf-primary">Toevoegen</button></div></form>`);
      d.classList.add('hf-employee-dialog');
      const drivers=document.createElement('section');drivers.className='hf-driver-list';drivers.innerHTML='<h3>Monteurs die ook rijden</h3>'+state.employees.filter(p=>p.role==='mechanic').map(p=>'<label class="hf-flag"><input type="checkbox" data-drive-employee="'+p.id+'" '+(p.canDrive?'checked':'')+'>'+esc(p.name)+' ook als chauffeur</label>').join('');d.querySelector('h2').after(drivers);
      drivers.querySelectorAll('[data-drive-employee]').forEach(input=>input.onchange=async()=>{const value=input.checked;input.disabled=true;const ok=await commit({...state,employees:state.employees.map(p=>p.id===input.dataset.driveEmployee?{...p,canDrive:value}:p)});if(!ok){input.checked=!value;d.querySelector('.hf-form-error').textContent=message;}input.disabled=false;});
      d.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),name=f.get('name').trim();if(!name)return;
        if(state.employees.some(p=>p.name.toLowerCase()===name.toLowerCase()&&p.role===f.get('role'))){d.querySelector('.hf-form-error').textContent='Deze medewerker bestaat al met deze functie.';return;}
        if(await commit({...state,employees:[...state.employees,{id:uid(),name,role:f.get('role'),canDrive:f.has('canDrive')}]}))d.close();else d.querySelector('.hf-form-error').textContent=message;
      };
    }
    let customers=[],machines=[];
    async function recordDialog(kind,customerId,onSaved){
      const customer=kind==='customer';
      const html=customer?field('Bedrijfsnaam','companyName','','text','required maxlength="180"')+field('Adres','address')+field('Plaats','city')+field('Contactpersoon','contactName')+field('Telefoon','phone')+field('E-mail','email','','email'):'<label>Machinetype<select name="machineType">'+options([{id:'heftruck_reachtruck',name:'Heftruck / reachtruck'},{id:'palletwagen_stapelaar',name:'Palletwagen / stapelaar'},{id:'hoogwerker',name:'Hoogwerker'},{id:'graafmachine',name:'Graafmachine'},{id:'shovel',name:'Shovel'},{id:'verreiker',name:'Verreiker'},{id:'batterij_lader',name:'Batterij / lader'},{id:'stellingmateriaal',name:'Stellingmateriaal'}],'heftruck_reachtruck')+'</select></label>'+field('Merk','brand','','text','required')+field('Type','model','','text','required')+field('Vlootnummer','internalNumber')+field('Serienummer','serialNumber')+field('Bouwjaar','buildYear','','text','pattern="[0-9]{4}"');
      const d=dialog('<h2>'+(customer?'Nieuwe klant':'Nieuwe machine')+'</h2><form>'+html+'<p class="hf-form-error" role="alert"></p><div class="hf-form-actions"><button type="button" data-close>Annuleren</button><button type="submit" class="hf-primary">Opslaan in systeem</button></div></form>');
      d.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{const payload={...Object.fromEntries(new FormData(e.target)),kind,...(!customer?{customerId}:{})};const result=await request('POST',payload,'/api/werkplaats/relaties');await onSaved(result.id);d.close();}catch(error){d.querySelector('.hf-form-error').textContent=error.message;button.disabled=false;}};
    }
    root.addEventListener('click',e=>{const button=e.target.closest('[data-pool-create]');if(button&&canEdit)void edit(null,{kind:button.dataset.poolCreate==='stock'?'Voorraadtruck':'Klantreparatie'});});
    async function edit(existing, preset={}, transportPreset={}, planningEdit=false) {
      if(!canEdit&&!existing)return;
      if(!canEdit||(existing&&!planningEdit&&!Object.keys(transportPreset).length)){viewJob(existing);return;}
      let allMachines=[];try{const relations=await request('GET',undefined,'/api/werkplaats/relaties?machines=all');customers=relations.customers;allMachines=relations.machines;machines=allMachines;}catch(error){message=error.message;render();return;}
      const isNew=!existing;
      const j={id:uid(),number:'Nieuwe bon',createdAt:new Date().toISOString(),customer:'',machine:'',serial:'',task:'',notes:'',employee:'',date:'',time:'08:00',duration:120,status:'Nieuw',checks:[false,false,false],transport:null,...existing,...preset};
      const transportPrep=state.transports.find(ticket=>ticket.jobId===j.id);
      const t={driver:'',date:'',time:'08:00',duration:60,pickup:'Eigen werkplaats',address:j.deliveryAddress||'',contact:'',instructions:'',state:'Gepland',confirmation:'',...j.transport,...transportPrep,...transportPreset};
      const checks=['Werkzaamheden uitgevoerd','Veiligheid en werking gecontroleerd','Machine en accessoires klaar voor transport'];
      const d=dialog(`<form class="hf-job-form"><div class="hf-dialog-title"><div><div class="hf-eyebrow">WERKBON</div><h2>${esc(j.number)}</h2></div><button type="button" data-close aria-label="Sluiten">✕</button></div><div class="hf-form-grid"><section><h3>Werkplaats</h3><div class="hf-fields"><label class="hf-picker" data-picker="customer">Klant zoeken<input name="customerSearch" autocomplete="off" required role="combobox" aria-expanded="false" placeholder="Zoek en kies een klant"><input type="hidden" name="customerId" value="${esc(j.customerId||'')}"><div role="listbox" hidden></div></label><button type="button" data-new-customer>＋ Nieuwe klant</button><label class="hf-picker" data-picker="machine">Machine zoeken (intern nummer / serienummer)<input name="machineSearch" autocomplete="off" required role="combobox" aria-expanded="false" placeholder="Intern nummer of (deel van) serienummer"><input type="hidden" name="machineId" value="${esc(j.machineId||'')}"><div role="listbox" hidden></div></label><button type="button" data-new-machine>＋ Nieuwe machine</button>${!j.customerId&&existing?'<p>Bestaande bon: '+esc(j.customer)+' · '+esc(j.machine)+'. Koppel deze aan de klantenbak.</p>':''}${field('Machine','machineName',j.machine,'text','readonly')}${field('Intern nummer','internalNumber',j.internalNumber||'','text','readonly')}${field('Serienummer','serial',j.serial,'text','readonly')}${field('Urenstand machine','hourReading',j.hourReading||'','number','min="0" step="any"')}<label>Medewerker<select name="employee"><option value="">Nog toewijzen</option>${options(state.employees.filter(p=>p.role==='mechanic'),j.employee)}</select></label>${field('Datum','date',j.date,'date')}${field('Begintijd','time',j.time,'time','required step="900"')}${field('Geschatte tijd (uren)','estimatedHours',j.estimatedMinutes===undefined?'':j.estimatedMinutes/60,'number','min="0.25" max="24" step="0.25"')}<small>Een richttijd voor deze klus. De werkelijk bestede tijd vul je apart in.</small>${field('Afleveradres','deliveryAddress',j.deliveryAddress||'')}<label>Soort werkbon<select name="kind">${options(KINDS,j.kind||'Klantreparatie')}</select></label><label class="hf-flag"><input type="checkbox" name="urgent" ${j.urgent?'checked':''}>Spoed</label><label>Status<select name="status">${options(STATUSES.filter(status=>(!['Afgerond','Klaar voor transport','Geannuleerd','Pauze'].includes(status)||j.status===status)),j.status)}</select></label></div><label>Werkzaamheden<textarea autocomplete="off" name="task" required rows="4" maxlength="6000">${esc(j.task)}</textarea></label><div class="hf-task-suggestions" aria-label="Eerder gebruikte werkzaamheden"></div><h3>Check-up · selecteer wat gecontroleerd moet worden</h3><div class="hf-checklist">${CHECKS.map((c,i)=>`<label><input type="checkbox" name="requiredCheck${i}" ${j.requiredChecks?.[i]?'checked':''}>${c}</label>`).join('')}</div><label>Gebruikte onderdelen<textarea name="usedParts" rows="4" maxlength="6000">${esc(j.usedParts||'')}</textarea></label><label>Opmerkingen monteur<textarea name="notes" rows="3" maxlength="6000">${esc(j.notes)}</textarea></label>${activityHtml(j)}</section>
      <section class="hf-transport"><h3>Transport voorbereiden</h3><label class="hf-flag"><input type="checkbox" name="transportRequired" ${(j.transportRequired??Boolean(transportPrep&&!transportPrep.deletedAt))?'checked':''}>Transport nodig</label><p>Alleen met dit vinkje wordt een transportbon aangemaakt. Zonder transport blijft de werkbon gewoon beschikbaar. Inplannen kan na kantoorcontrole en betaling.</p><fieldset data-transport-fields><button type="button" data-open-transport ${isNew||!transportPrep?'disabled':''}>Transportbon openen</button>${field('Ophaaladres transport','transportPickup',t.pickup)}${field('Contactpersoon transport','transportContact',t.contact)}<label>Transport voorbereiden / instructies<textarea name="transportInstructions" rows="4" maxlength="6000">${esc(t.instructions)}</textarea></label></fieldset><p>Gebruik de tab Transportplanning voor de transportbakken en dagvolgorde.</p></section></div><p role="alert" class="hf-form-error"></p><div class="hf-form-actions">${!isNew?(completed(j)?'':'<button type="button" data-cancel-job>Werkbon annuleren</button>')+'<button type="button" data-trash-job>Werkbon verwijderen</button><button type="button" data-print>Print werkbon</button>':''}<button type="button" data-close>Annuleren</button><button class="hf-primary" type="submit">${isNew?'Werkbon maken':'Wijzigingen opslaan'}</button></div></form>`);
      const form=d.querySelector('form');
      const transportToggle=d.querySelector('[name="transportRequired"]'),transportFields=d.querySelector('[data-transport-fields]');
      const showTransport=()=>{transportFields.hidden=!transportToggle.checked;transportFields.disabled=!transportToggle.checked;};transportToggle.onchange=showTransport;showTransport();
      d.querySelector('[data-open-transport]').onclick=()=>{const ticket=state.transports.find(t=>t.jobId===j.id);if(ticket){d.close();transportEdit(ticket);}};
      bindCancel(d,j);bindJobArchive(d,j);
      if(existing?.kind==='Voorraadtruck'){
        const transfer=document.createElement('fieldset');transfer.innerHTML='<legend>Voorraad overzetten naar klant</legend><label class="hf-flag"><input type="checkbox" name="stockInvoiced"> Machine gefactureerd · machine en werkbon overzetten</label><label>Klant<select name="transferCustomerId"><option value="">Kies de koper</option>'+options(customers.filter(c=>!c.stock).map(c=>({id:c.id,name:c.companyName})),'')+'</select></label>'+field('Factuurreferentie machine','stockInvoiceReference',j.stockInvoiceReference||'');form.querySelector('.hf-transport').appendChild(transfer);
      }
      const customerSelect=form.elements.customerId,machineSelect=form.elements.machineId;
      let machineRequest=0;
      const machineName=m=>[m.brand,m.model].filter(Boolean).join(' ');
      const machineLabel=m=>[machineName(m),m.internalNumber?'Intern nummer: '+m.internalNumber:'',m.serialNumber?'Serienummer: '+m.serialNumber:''].filter(Boolean).join(' — ');
      function fillMachine(keepReading=false){const m=machines.find(m=>m.id===machineSelect.value);form.elements.machineName.value=m?machineName(m):'';form.elements.internalNumber.value=m?.internalNumber||'';form.elements.serial.value=m?.serialNumber||'';if(!keepReading||!form.elements.hourReading.value)form.elements.hourReading.value=m?.configuration?.hour_reading||'';}
      function picker(kind,records,label,onchange){
        const host=form.querySelector('[data-picker="'+kind+'"]'),input=form.elements[kind+'Search'],id=form.elements[kind+'Id'],list=host.querySelector('[role="listbox"]');let active=-1;
        const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');};
        const sync=()=>{input.value=label(records().find(r=>r.id===id.value))||'';input.setCustomValidity(id.value?'':'Kies een resultaat uit de lijst.');close();};
        const show=()=>{const matches=records().filter(r=>label(r).toLowerCase().includes(input.value.toLowerCase())).filter((r,i,list)=>kind!=='customer'||!r.stock||list.findIndex(c=>c.stock)===i).slice(0,50);list.replaceChildren();active=-1;
          if(!matches.length){const empty=document.createElement('span');empty.textContent='Geen resultaten';list.appendChild(empty);}
          matches.forEach(r=>{const option=document.createElement('button');option.type='button';option.setAttribute('role','option');if(kind==='machine'){
            option.classList.add('hf-machine-result');
            const title=document.createElement('strong');title.textContent=machineName(r)||'Machine';option.appendChild(title);
            for(const [caption,value] of [['Intern nummer',r.internalNumber],['Serienummer',r.serialNumber]]){if(!value)continue;const line=document.createElement('span');const name=document.createElement('span');name.className='hf-machine-caption';name.textContent=caption+': ';line.appendChild(name);line.appendChild(document.createTextNode(value));option.appendChild(line);}
            const owner=customers.find(c=>c.id===r.customerId);if(owner&&r.customerId!==customerSelect.value){const customer=document.createElement('small');customer.textContent=owner.companyName;option.appendChild(customer);}
          }else option.textContent=label(r);option.onmousedown=e=>e.preventDefault();option.onclick=()=>{id.value=r.id;sync();onchange();};list.appendChild(option);});list.hidden=false;input.setAttribute('aria-expanded','true');};
        input.oninput=()=>{id.value='';input.setCustomValidity('Kies een resultaat uit de lijst.');onchange();show();};input.onfocus=show;input.onblur=close;
        input.onkeydown=e=>{if(e.key==='Escape'){close();return;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(list.hidden)show();const choices=Array.from(list.querySelectorAll('button'));active=choices.length?(active+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length:-1;choices.forEach((c,i)=>c.setAttribute('aria-selected',String(i===active)));choices[active]?.scrollIntoView({block:'nearest'});}if(e.key==='Enter'&&!list.hidden){e.preventDefault();list.querySelectorAll('button')[active<0?0:active]?.click();}};sync();return {sync,input};
      }
      let machinePicker;
      const availableMachines=()=>allMachines.filter(m=>{const owner=customers.find(c=>c.id===m.customerId);if(form.elements.kind.value==='Voorraadtruck')return owner?.stock;const selected=customers.find(c=>c.id===customerSelect.value);return !selected||m.customerId===selected.id||(selected.stock&&owner?.stock);});
      const loadMachines=async(selected='')=>{machineRequest++;machineSelect.value=selected;machines=allMachines;fillMachine();machinePicker.sync();d.querySelector('[data-new-machine]').disabled=!customerSelect.value;};
      const customerPicker=picker('customer',()=>customers,c=>c?.companyName||'',()=>{void loadMachines();});
      machinePicker=picker('machine',availableMachines,m=>m?[machineLabel(m),customers.find(c=>c.id===m.customerId)?.companyName].filter(Boolean).join(' · '):'',()=>{const m=allMachines.find(m=>m.id===machineSelect.value);if(m){customerSelect.value=m.customerId;if(customers.find(c=>c.id===m.customerId)?.stock&&form.elements.kind.value==='Klantreparatie')form.elements.kind.value='Voorraadtruck';customerPicker.sync();}fillMachine();});
      form.elements.kind.onchange=()=>{customerSelect.value='';customerPicker.sync();void loadMachines();};
      fillMachine(true);d.querySelector('[data-new-machine]').disabled=!customerSelect.value;
      d.querySelector('[data-new-customer]').onclick=()=>void recordDialog('customer','',async id=>{customers=(await request('GET',undefined,'/api/werkplaats/relaties')).customers;customerSelect.value=id;customerPicker.sync();await loadMachines();});
      d.querySelector('[data-new-machine]').onclick=()=>{if(customerSelect.value)void recordDialog('machine',customerSelect.value,async id=>{allMachines=(await request('GET',undefined,'/api/werkplaats/relaties?machines=all')).machines;await loadMachines(id);fillMachine();});};
      const task=form.elements.task,suggestions=d.querySelector('.hf-task-suggestions');
      task.oninput=()=>{const before=task.value.slice(0,task.selectionStart),fragment=before.split(/[\n.!?]/).pop().trim().toLowerCase();const known=Array.from(new Set([...(state.taskSuggestions||[]),...state.jobs.flatMap(j=>j.task.split(/[\n.!?]+/).map(s=>s.trim()))]));suggestions.replaceChildren();if(fragment.length<2)return;known.filter(t=>t.toLowerCase().includes(fragment)&&t.toLowerCase()!==fragment).slice(0,6).forEach(text=>{const button=document.createElement('button');button.type='button';button.textContent=text;button.onclick=()=>{const cursor=task.selectionStart,prefix=task.value.slice(0,cursor),start=Math.max(prefix.lastIndexOf('\n'),prefix.lastIndexOf('.'),prefix.lastIndexOf('!'),prefix.lastIndexOf('?'))+1;task.value=task.value.slice(0,start)+(start?' ':'')+text+task.value.slice(cursor);task.focus();const next=start+(start?1:0)+text.length;task.setSelectionRange(next,next);suggestions.replaceChildren();};suggestions.appendChild(button);});};
      function read() {
        const f=new FormData(form), val=n=>String(f.get(n)||'').trim();
        const customer=customers.find(c=>c.id===val('customerId')),machine=machines.find(m=>m.id===val('machineId'));
        const updated={...j,transportRequired:f.has('transportRequired'),customerId:val('customerId'),machineId:val('machineId'),customer:customer?.companyName||j.customer,machine:machine?machineName(machine):j.machine,internalNumber:val('internalNumber'),deliveryAddress:val('deliveryAddress'),hourReading:val('hourReading'),usedParts:val('usedParts'),kind:val('kind'),urgent:f.has('urgent'),requiredChecks:CHECKS.map((_,i)=>f.has('requiredCheck'+i)),checkedPoints:j.checkedPoints||CHECKS.map(()=>false),serial:val('serial'),task:val('task'),notes:val('notes'),employee:val('employee'),date:val('date'),time:val('time'),duration:(Number(val('estimatedHours').replace(',','.'))*60)||j.duration||120,...(val('estimatedHours')?{estimatedMinutes:(Number(val('estimatedHours').replace(',','.'))*60)}:{estimatedMinutes:undefined}),status:val('status'),checks:[j.checks[0],j.checks[1],j.checks[2]]};
        if(f.has('stockInvoiced')){updated.customerId=val('transferCustomerId');updated.customer=customers.find(c=>c.id===updated.customerId)?.companyName||'';updated.kind='Verkooptruck';updated.stockInvoiceReference=val('stockInvoiceReference');updated.stockInvoiced=true;}
        if(updated.status==='Afgerond')updated.completedAt=j.completedAt||new Date().toISOString();else delete updated.completedAt;
        if(updated.status==='Klaar voor transport')updated.checks=[true,true,true];
        updated.transport=null;
        return updated;
      }
      if(!isNew)d.querySelector('[data-print]').onclick=()=>{if(!canEdit)printJob(j);else printJob(read());};
      form.onsubmit=async e=>{
        e.preventDefault();if(busy)return;
        const updated=read(),err=d.querySelector('.hf-form-error');
        const fail=text=>{err.textContent=text;err.scrollIntoView({block:'nearest'});};
        if(updated.stockInvoiced&&(!updated.stockInvoiceReference||!updated.customerId))return fail('Kies de koper en vul de factuurreferentie van de machine in.');
        if(!updated.customerId||!updated.machineId)return fail('Kies een klant en een machine uit het systeem.');
        if(updated.kind==='Voorraadtruck'&&!updated.estimatedMinutes)return fail('Vul voor een voorraadklus een geschatte tijd in.');
        if(['Werkbon-controle','Klaar voor transport','Afgerond'].includes(updated.status)&&!requiredDone(updated))return fail('Laat de monteur eerst alle gekozen check-up punten afvinken.');
        if(updated.status!=='Nieuw'&&(!updated.employee||!updated.date))return fail('Kies een monteur en datum voor deze status.');
        if(Boolean(updated.employee)!==Boolean(updated.date))return fail('Vul zowel een monteur als een datum in, of laat beide leeg voor een nieuwe bon.');
        if(updated.status==='Klaar voor transport'&&!updated.checks.every(Boolean))return fail('Vink eerst alle drie de werkplaatscontroles af.');
        if(!Number.isFinite(updated.duration)||updated.duration<15||updated.duration%15)return fail('Kies een geschatte tijd in stappen van een kwartier (0,25 uur).');
        if(minutes(updated.time)+updated.duration>1440)return fail('De werkplaatsopdracht moet binnen dezelfde dag vallen.');
        if(!completed(updated)&&collision(state.jobs,updated,'workshop'))return fail('Deze monteur heeft op dat tijdstip al een bon. Kies een andere begintijd.');
        if(updated.transport){const tr=updated.transport;if(!tr.driver||!tr.date||!tr.time||!tr.pickup||!tr.address||!tr.contact)return fail('Vul chauffeur, transportdatum, vertrektijd, ophaaladres, afleveradres en contactpersoon in.');if(tr.duration<15||tr.duration>1440||tr.duration%15||minutes(tr.time)+tr.duration>1440)return fail('Vul een geldige ritduur in die binnen dezelfde dag valt.');if(tr.state==='Afgeleverd'&&!tr.confirmation)return fail('Noteer bij aflevering wie de machine heeft ontvangen.');if(collision(state.jobs,updated,'driver'))return fail('Deze chauffeur heeft op dat tijdstip al een rit.');}
        if(isNew)updated.number=`WB-${String(Math.max(state.nextJobNumber||1,Math.max(0,...state.jobs.map(x=>Number(x.number.slice(3))||0))+1)).padStart(4,'0')}`;
        const submit=form.querySelector('[type=submit]');submit.disabled=true;
        const formData=new FormData(form);let next=workflow.normalize({...state,jobs:isNew?[...state.jobs,updated]:state.jobs.map(x=>x.id===updated.id?updated:x)});next={...next,transports:next.transports.map(ticket=>ticket.jobId===updated.id&&updated.transportRequired?{...ticket,pickup:String(formData.get('transportPickup')||'').trim(),contact:String(formData.get('transportContact')||'').trim(),instructions:String(formData.get('transportInstructions')||'').trim(),address:transportPrep?.address&&transportPrep.address!==j.deliveryAddress?transportPrep.address:updated.deliveryAddress||''}:ticket)};
        if(demo&&updated.stockInvoiced&&!j.stockInvoiced){submit.disabled=false;fail('Overzetten naar een klant is beschikbaar in de gedeelde omgeving.');return;}
        if(demo&&updated.machineId&&updated.hourReading&&(isNew||updated.machineId!==j.machineId||updated.hourReading!==j.hourReading)){try{await request('PATCH',{machineId:updated.machineId,customerId:updated.customerId,hourReading:updated.hourReading},'/api/werkplaats/relaties');}catch(error){submit.disabled=false;fail(error.message);return;}}
        const ok=await commit(next);
        if(ok)d.close();else{submit.disabled=false;fail(message);}
      };
    }
    function bindCancel(d,j) {
      const button=d.querySelector('[data-cancel-job]');if(!button)return;
      button.onclick=async()=>{
        if(busy||!canEdit||j.status==='Geannuleerd')return;
        const reason=window.prompt('Reden voor annuleren van '+j.number+' (de bon en historie blijven bewaard):');if(!reason?.trim())return;
        button.disabled=true;
        const ok=await commit({...state,jobs:state.jobs.map(item=>item.id===j.id?{...item,status:'Geannuleerd',cancellationReason:reason.trim()}:item)});
        if(ok){message='Werkbon '+j.number+' geannuleerd.';d.close();render();}
        else{button.disabled=false;d.querySelector('.hf-form-error').textContent=message;}
      };
    }
    function bindJobArchive(d,j){
      const remove=d.querySelector('[data-trash-job]'),restore=d.querySelector('[data-restore-job]');
      const update=async(restoring)=>{
        if(busy||!canEdit)return;
        if(!window.confirm(restoring?'Werkbon terugzetten? Open bonnen komen ongepland terug. Afgesloten bonnen behouden hun afsluiting. Transport moet apart worden teruggezet.':'Werkbon '+j.number+' naar de archiefbak verplaatsen? Gegevens, uren, facturatie en historie blijven bewaard. Gekoppeld transport verdwijnt uit de planning.'))return;
        const button=restoring?restore:remove;button.disabled=true;
        const next={...state,jobs:state.jobs.map(job=>job.id===j.id?{...job,deletedAt:restoring?undefined:new Date().toISOString(),deletedBy:restoring?undefined:job.deletedBy}:job)};
        if(await commit(next)){message=restoring?'Werkbon teruggezet.':'Werkbon naar archiefbak verplaatst.';d.close();render();}
        else{button.disabled=false;const error=document.createElement('p');error.setAttribute('role','alert');error.textContent=message;d.appendChild(error);}
      };
      if(remove)remove.onclick=()=>update(false);if(restore)restore.onclick=()=>update(true);
    }
    function activityHtml(j) {
      const labels={check:'Check-up bijgewerkt',claim:'Voorraadklus opgepakt',start:'Mee bezig',pause:'Pauze',parts:'Wachten op onderdelen',review:'Afronden / werkbon-controle',hold:'On hold',note:'Notitie',time:'Bestede tijd ingevuld'};
      const updates=(j.updates||[]).length?'<h3>Werkplaatsupdates</h3><div class="hf-updates">'+j.updates.slice().reverse().map(u=>'<article><strong>'+esc(u.employeeName)+' · '+esc(labels[u.action]||u.action)+'</strong><small>'+esc(new Date(u.at).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'}))+'</small>'+(u.actualMinutes!==undefined?'<p>Werkelijk besteed: '+esc(spentTime(u.actualMinutes))+'</p>':'')+(u.text?'<p class="hf-readable">'+esc(u.text)+'</p>':'')+'</article>').join('')+'</div>':'';
      const office=canApprove&&(j.officeHistory||[]).length?'<h3>Kantoorhistorie</h3><div class="hf-updates">'+j.officeHistory.slice().reverse().map(u=>'<article><strong>'+esc(u.action==='reopened'?'Werkbon heropend':'Facturatie bijgewerkt')+' · '+esc(u.by)+'</strong><small>'+esc(new Date(u.at).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'}))+'</small><p>Factuur: '+esc(u.invoiceReference||'—')+' · '+(u.invoicePaidAt?'Betaald op '+esc(new Date(u.invoicePaidAt).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'})):'Niet als betaald geregistreerd')+'</p></article>').join('')+'</div>':'';
      const archive=(j.archiveHistory||[]).length?'<h3>Archiefhistorie</h3><div class="hf-updates">'+j.archiveHistory.slice().reverse().map(u=>'<article><strong>'+esc(u.action==='deleted'?'Naar archiefbak':'Teruggezet')+' · '+esc(u.by)+'</strong><small>'+esc(new Date(u.at).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'}))+'</small><p>'+esc(u.status)+' · '+esc(u.date)+' · '+esc(personName(u.employee))+'</p></article>').join('')+'</div>':'';
      return updates+office+archive;
    }
    function viewJob(j,saved=false) {
      const t=j.transport,free=!!j.date&&!!j.employee&&!t&&!completed(j)&&j.status!=='Klaar voor transport',claimable=j.kind==='Voorraadtruck'&&!j.employee&&!j.date&&!completed(j);
      const actions=[['start','Mee bezig','Mee bezig'],['parts','Wachten op onderdelen','Wachten op onderdelen'],['review','✓ Afronden / te controleren','Werkbon-controle'],['hold','On hold','On hold']];
      const header='<div class="hf-dialog-title"><div><div class="hf-eyebrow">WERKPLAATS</div><h2>'+esc(j.number)+' · '+esc(j.machine)+'</h2><p>Status: <strong>'+esc(j.deletedAt?'Archiefbak · '+j.status:j.status)+'</strong></p></div><button data-close aria-label="Sluiten">✕</button></div>';
      const info='<section><h3>'+esc(j.customer)+'</h3><p><strong>Monteur:</strong> '+esc(personName(j.employee))+'<br><strong>Planning:</strong> '+pretty(j.date)+' '+esc(j.time)+'<br><strong>Intern nummer:</strong> '+(esc(j.internalNumber)||'—')+'<br><strong>Serienummer:</strong> '+(esc(j.serial)||'—')+'</p>'+(j.deliveryAddress?'<p><strong>Afleveradres:</strong> '+esc(j.deliveryAddress)+'</p>':'')+(j.estimatedMinutes?'<p class="hf-estimate"><strong>Richttijd:</strong> '+esc(spentTime(j.estimatedMinutes))+' · een indicatie voor deze klus</p>':'')+'<p><strong>Soort:</strong> '+esc(j.kind||'Klantreparatie')+(j.urgent?' · Spoed':'')+'</p>'+(j.customerId&&canEdit?'<p><a href="/klanten/'+encodeURIComponent(j.customerId)+'">Klantkaart</a> · <a href="/machines/'+encodeURIComponent(j.machineId)+'">Machinekaart</a></p>':'')+(j.stockInvoiced?'<p><strong>Voorraadmachine gefactureerd:</strong> '+esc(j.stockInvoiceReference)+' · overgezet naar klant</p>':'')+'<h3>Werkzaamheden</h3><p class="hf-readable">'+esc(j.task)+'</p>'+(j.usedParts?'<h3>Gebruikte onderdelen</h3><p class="hf-readable">'+esc(j.usedParts)+'</p>':'')+(j.hourReading?'<p><strong>Urenstand machine:</strong> '+esc(j.hourReading)+'</p>':'')+(j.notes?'<h3>Opmerkingen monteur</h3><p class="hf-readable">'+esc(j.notes)+'</p>':'')+'<h3>Werkelijk bestede tijd</h3><p>'+esc(spentTime(j.actualMinutes))+'</p>'+activityHtml(j)+'</section>';
      const controls='<section class="hf-worklog-panel"><h3>Voortgang doorgeven</h3><form class="hf-worklog-form"><label>Jouw naam<select name="employeeId" required><option value="">Kies je naam</option>'+options(state.employees.filter(p=>p.role==='mechanic'),j.employee)+'</select></label>'+(claimable?'<button type="submit" name="action" value="claim">Deze voorraadklus oppakken</button>':'')+'<div class="hf-worklog-actions">'+actions.map(([action,label,status])=>'<button type="submit" name="action" value="'+action+'" '+(!free||j.status===status||(action==='pause'&&j.status!=='Mee bezig')?'disabled':'')+'>'+label+'</button>').join('')+'</div><fieldset class="hf-check-up"><legend>Check-up</legend>'+((j.requiredChecks||[]).some(Boolean)?CHECKS.map((label,i)=>j.requiredChecks[i]?'<label><input type="checkbox" name="checkedPoint'+i+'" '+(j.checkedPoints?.[i]?'checked':'')+'>'+esc(label)+'</label>':'').join(''):'<p>De planner heeft geen aanvullende controlepunten geselecteerd.</p>')+'<button type="submit" name="action" value="check">Controlepunten opslaan</button></fieldset><label>Notitie<textarea name="text" rows="4" maxlength="3000" placeholder="Wat heb je gedaan of wat is er nodig?"></textarea></label><fieldset class="hf-actual-time"><legend>Werkelijk bestede tijd · totaal voor deze bon</legend><div class="hf-fields">'+field('Uren','actualHours',j.actualMinutes===undefined?'':Math.floor(j.actualMinutes/60),'number','min="0" max="10000" step="1"')+field('Minuten','actualMins',j.actualMinutes===undefined?'':j.actualMinutes%60,'number','min="0" max="59" step="1"')+'</div><button type="submit" name="action" value="time">Bestede tijd opslaan</button></fieldset>'+(!free?'<p>Alleen notities en bestede tijd mogelijk: deze bon is nog niet ingepland of is al vrijgegeven voor transport.</p>':'')+'<p class="hf-form-error" role="alert"></p><button class="hf-primary" type="submit" name="action" value="note">Notitie toevoegen</button></form>'+(t?'<h3>Voor de chauffeur</h3><p><strong>'+esc(personName(t.driver))+'</strong> · '+pretty(t.date)+' '+esc(t.time)+'<br>'+esc(t.pickup)+' → '+esc(t.address)+'<br>'+esc(t.contact)+'</p><p class="hf-readable">'+esc(t.instructions)+'</p>':'')+'</section>';
      const d=dialog(header+(saved?'<p role="status" class="hf-estimate">Wijzigingen opgeslagen</p>':'')+'<div class="hf-form-grid hf-reading">'+info+(completed(j)?'<section><h3>'+esc(j.status)+'</h3><p>Deze werkbon en de werkplaatsupdates blijven bewaard bij de klant en machine.</p><h3>Check-up</h3>'+CHECKS.map((label,i)=>j.requiredChecks?.[i]?'<p>'+(j.checkedPoints?.[i]?'☑ ':'☐ ')+esc(label)+'</p>':'').join('')+'</section>':controls)+'</div>'+officePanel(j)+'<div class="hf-form-actions"><button data-print>Print werkbon</button><button data-view-transport>Transportbon openen</button>'+(canEdit?(j.deletedAt?'<button data-restore-job>Terugzetten uit archiefbak</button>':'<button data-trash-job>Werkbon verwijderen</button>'+(j.status==='Geannuleerd'?'':'<button data-cancel-job>Werkbon annuleren</button><button data-edit-planning>Planning & bon bewerken</button>')):'')+''+(!completed(j)?'<button data-save-worklog class="hf-primary">Wijzigingen opslaan</button>':'')+'<button data-close>Sluiten</button></div>');
      d.querySelector('[data-print]').onclick=()=>printJob(j);
      bindCancel(d,j);bindOffice(d,j);
      d.querySelector('[data-view-transport]').onclick=()=>{const ticket=state.transports.find(t=>t.jobId===j.id);if(ticket){d.close();transportEdit(ticket);}};
      const planningButton=d.querySelector('[data-edit-planning]');if(planningButton)planningButton.onclick=()=>{if(busy)return;d.close();edit(j,{}, {},true);};
      const form=d.querySelector('.hf-worklog-form');if(!form)return;const saveButton=d.querySelector('[data-save-worklog]');if(saveButton)saveButton.onclick=()=>form.requestSubmit();let retryKey='',retryId='';
      form.querySelectorAll('.hf-actual-time input').forEach(input=>input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();form.requestSubmit(form.querySelector('[value="time"]'));}});
      form.onsubmit=async e=>{
        e.preventDefault();if(busy)return;
        const f=new FormData(form),action=e.submitter?.value||(String(f.get('text')||'').trim()?'note':'check'),employeeId=String(f.get('employeeId')||''),text=String(f.get('text')||'').trim(),err=form.querySelector('.hf-form-error');
        if(action==='note'&&!text){err.textContent='Vul een notitie in.';return;}
        const hours=String(f.get('actualHours')||'').trim(),mins=String(f.get('actualMins')||'').trim();
        const entered=hours!==''||mins!=='';
        const total=Number(hours||0)*60+Number(mins||0);
        if(entered&&(!Number.isInteger(Number(hours||0))||!Number.isInteger(Number(mins||0))||Number(hours||0)<0||Number(mins||0)<0||Number(mins||0)>59||total>600000)){err.textContent='Vul geldige uren en minuten in (0–59 minuten).';return;}
        if(action==='time'&&!entered){err.textContent='Vul de werkelijk bestede tijd in.';return;}
        const actualMinutes=entered&&(action==='time'||total!==j.actualMinutes)?total:undefined;
        const checkedPoints=CHECKS.map((_,i)=>f.has('checkedPoint'+i));
        if(action==='review'&&(j.requiredChecks||[]).some((needed,i)=>needed&&!checkedPoints[i])){err.textContent='Vink eerst alle geselecteerde controlepunten af.';return;}
        const payloadKey=JSON.stringify({employeeId,action,text,actualMinutes,checkedPoints});if(payloadKey!==retryKey){retryKey=payloadKey;retryId=uid();}
        const payload={jobId:j.id,employeeId,action,text,checkedPoints,requestId:retryId,...(actualMinutes!==undefined?{actualMinutes}:{})};
        const disabledButtons=Array.from(form.querySelectorAll('button')).map(b=>[b,b.disabled]);disabledButtons.forEach(([b])=>b.disabled=true);busy=true;err.textContent='';
        try{
          if(demo){const employee=state.employees.find(p=>p.id===employeeId);if(!employee)throw new Error('Kies je naam.');const current=state.jobs.find(p=>p.id===j.id);if(!current)throw new Error('Werkbon niet gevonden.');if(!['note','time','check','claim'].includes(action)&&!free)throw new Error('Deze status kan niet op de tablet worden gewijzigd.');const statuses={start:'Mee bezig',pause:'Pauze',parts:'Wachten op onderdelen',review:'Werkbon-controle',hold:'On hold'};let claim={};if(action==='claim'){if(!claimable)throw new Error('Deze klus is al ingepland.');const candidate={...current,employee:employeeId,date:localDate(new Date())};const now=new Date();let start=Math.max(480,Math.ceil((now.getHours()*60+now.getMinutes())/15)*15);for(;start+current.duration<=1440;start+=15){candidate.time=String(Math.floor(start/60)).padStart(2,'0')+':'+String(start%60).padStart(2,'0');if(!collision(state.jobs,candidate,'workshop'))break;}if(start+current.duration>1440)throw new Error('Vandaag is er geen ruimte meer; vraag de planner.');claim={employee:candidate.employee,date:candidate.date,time:candidate.time};}const changed={...current,...claim,checkedPoints,status:['note','time','check'].includes(action)?current.status:action==='claim'?'Mee bezig':statuses[action],...(actualMinutes!==undefined?{actualMinutes}:{}),updates:[...(current.updates||[]),{id:retryId,employeeId,employeeName:employee.name,action,text,at:new Date().toISOString(),...(actualMinutes!==undefined?{actualMinutes}:{})}]};if(['Werkbon-controle','Klaar voor transport','Afgerond'].includes(changed.status)&&!requiredDone(changed))throw new Error('Deze bon kan niet gereed blijven met onvolledige controlepunten.');const next={...state,jobs:state.jobs.map(p=>p.id===j.id?changed:p)};localStorage.setItem(storageKey,JSON.stringify(next));state=next;}
          else{const result=await request('POST',payload,'/api/werkplaats/werkbon');state=workflow.normalize(result.state);baseState=structuredClone(state);version=result.version;}
          busy=false;message='Voortgang opgeslagen';render();d.close();viewJob(state.jobs.find(p=>p.id===j.id),true);
        }catch(error){err.textContent=error.message||'Bijwerken is niet gelukt.';disabledButtons.forEach(([b,disabled])=>b.disabled=disabled);}
        finally{busy=false;}
      };
    }
    function printJob(j) {const item=Object.fromEntries(['number','customer','machine','internalNumber','serial','date','time','hourReading','deliveryAddress','task','usedParts','notes','estimatedMinutes','actualMinutes','requiredChecks','checkedPoints'].map(key=>[key,j[key]]));item.employee=state.employees.find(e=>e.id===j.employee)?.name||'';void openPdf({type:'workshop',item});}

    render();
    const requested=new URLSearchParams(location.search).get('job');if(requested){const job=state.jobs.find(j=>j.id===requested);if(job)viewJob(job);}
    return ()=>{stopPointerDrag?.();if(refreshTimer)window.clearInterval(refreshTimer);root.querySelectorAll('dialog').forEach(d=>{if(d.open)d.close();d.remove();});if(dialogCount>0){dialogCount=0;document.body.style.overflow=previousOverflow;}};
  }
})();
