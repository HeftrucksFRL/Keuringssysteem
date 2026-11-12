(function () {
  'use strict';
  const STATUSES = ['Nieuw', 'Ingepland', 'Mee bezig', 'Wachten op onderdelen', 'Wachten op goedkeuring', 'Pauze', 'Werkbon-controle', 'On hold', 'Klaar voor transport'];
  const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const addDays = (s, n) => { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return localDate(d); };
  const weekStart = s => { const d = new Date(s+'T12:00:00'); return addDays(s, -(d.getDay()+6)%7); };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const minutes = t => Number(t.slice(0,2))*60+Number(t.slice(3));
  const uid = () => crypto.randomUUID();
  const pretty = s => s ? new Date(s+'T12:00:00').toLocaleDateString('nl-NL',{day:'numeric',month:'short'}) : 'Niet gepland';
  const options = (values, selected) => values.map(v => `<option value="${esc(v.id ?? v)}" ${(v.id ?? v) === selected ? 'selected' : ''}>${esc(v.name ?? v)}</option>`).join('');
  const field = (label, name, value='', type='text', extra='') => `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  function seed() {
    const today = localDate(new Date()), monday = weekStart(today);
    const employees = [{id:'jelle',name:'Jelle',role:'mechanic'},{id:'bauke',name:'Bauke',role:'mechanic'},{id:'timo',name:'Timo',role:'mechanic'},{id:'age',name:'Age',role:'driver'}];
    const base = {serial:'DEMO-1234',notes:'',checks:[false,false,false],date:today,time:'08:00',duration:120,transport:null};
    return {employees,jobs:[
      {...base,id:uid(),number:'WB-0001',customer:'Voorbeeld • Groenvoorziening',machine:'Linde E20 · VM1234',task:'Remmen controleren, onderhoud uitvoeren en verlichting nalopen.',employee:'jelle',status:'Mee bezig',date:addDays(monday,3)},
      {...base,id:uid(),number:'WB-0002',customer:'Voorbeeld • Bouwbedrijf',machine:'Toyota 8FBE · VM1250',task:'Hydrauliekslang vervangen. Controleer op lekkage.',employee:'bauke',status:'Wachten op onderdelen',date:addDays(monday,4),notes:'Nieuwe slang besteld. Leverdatum nog bevestigen.'},
      {...base,id:uid(),number:'WB-0003',customer:'Voorbeeld • Magazijn',machine:'Still RX20 · VM1261',task:'Machine en lader aflevergereed maken.',employee:'timo',status:'Klaar voor transport',checks:[true,true,true],date:addDays(monday,3),time:'10:00',transport:{driver:'age',date:addDays(monday,4),time:'09:00',duration:60,pickup:'Eigen werkplaats',address:'Voorbeeldweg 3, Sneek',contact:'Magazijnbeheer · 06 0000 0000',instructions:'Neem de lader mee. Gebruik de ingang achterom.',state:'Gepland',confirmation:''}},
      {...base,id:uid(),number:'WB-0004',customer:'Voorbeeld • Eigen voorraad',machine:'Jungheinrich EFG · VM1280',task:'Batterij testen en bevindingen noteren.',employee:'',status:'Nieuw',date:''}
    ]};
  }
  function collision(jobs, candidate, mode) {
    const c = mode === 'driver' ? candidate.transport : candidate;
    const person = mode === 'driver' ? c?.driver : c?.employee;
    if (!c || !c.date || !person || (mode === 'driver' && c.state === 'Afgeleverd')) return false;
    return jobs.some(j => {
      if (j.id === candidate.id) return false;
      const other = mode === 'driver' ? j.transport : j;
      if (!other || (mode === 'driver' && (j.status !== 'Klaar voor transport' || other.state === 'Afgeleverd'))) return false;
      return (mode === 'driver' ? other.driver : other.employee) === person && other.date === c.date && minutes(c.time) < minutes(other.time)+other.duration && minutes(other.time) < minutes(c.time)+c.duration;
    });
  }
  // Expose deterministic scheduling rules for verification and integrations.
  if (typeof module !== 'undefined' && module.exports) module.exports = {collision,weekStart,addDays};
  if (typeof document === 'undefined') return;
  window.HFWorkshopMount=init;
  document.querySelectorAll('[data-workshop-planner]:not([data-workshop-inline])').forEach(root=>void init(root));
  async function init(root, mountConfig) {
    const config = mountConfig || window.HFWorkshopConfig || {};
    const demo = !config.api;
    let canEdit = config.readOnly!==true && new URLSearchParams(location.search).get('tablet')!=='1';
    let dialogCount=0,previousOverflow='';
    let state = demo ? seed() : {employees:[],jobs:[]}, version = 0, busy = false;
    let mode='workshop', week=weekStart(localDate(new Date())), filter='', search='', message='', dragging=null;
    const storageKey='hf-workshop-agenda-v2';
    if (demo) { try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved && Array.isArray(saved.jobs) && Array.isArray(saved.employees)) state=saved; } catch { message='Eerdere proefgegevens konden niet worden geladen.'; } }
    async function request(method, body, endpoint=config.api) {
      const csrf=document.cookie.split('; ').find(c=>c.startsWith('ks_csrf='))?.slice(8) || '';
      const response = await fetch(endpoint,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','x-csrf-token':decodeURIComponent(csrf)},...(body ? {body:JSON.stringify(body)} : {})});
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.message || 'Opslaan mislukt.'),{conflict:response.status===409});
      return data;
    }
    if (!demo) { root.innerHTML='<p class="hf-loading">Planning laden…</p>'; try { const result=await request('GET'); state=result.state;version=result.version;canEdit=result.canEdit===true; } catch(e) {root.innerHTML=`<p role="alert">${esc(e.message)} Vernieuw de pagina om opnieuw te proberen.</p>`;return;} }
    if(config.isActive&&!config.isActive())return;
    async function commit(next) {
      if(!canEdit){message='Dit werkplaatsaccount heeft alleen kijkrechten.';return false;}
      if (busy) return false;
      busy=true;
      root.setAttribute('aria-busy','true');
      try {
        if (demo) localStorage.setItem(storageKey,JSON.stringify(next));
        else { const result=await request('PUT',{state:next,version}); version=result.version; }
        state=next; message='Opgeslagen'; return true;
      } catch(e) {
        message=e.message;
        if (e.conflict) { try {const latest=await request('GET');state=latest.state;version=latest.version;message='Een collega heeft de planning gewijzigd. De nieuwste planning is geladen; voer je wijziging opnieuw uit.';} catch { message='De planning is intussen gewijzigd. Vernieuw de pagina voordat je verdergaat.'; } }
        return false;
      } finally {busy=false;root.removeAttribute('aria-busy');render();}
    }
    async function refresh(manual=false) {
      if(demo||busy||dragging||root.querySelector('dialog[open]'))return;
      busy=true;
      try{const latest=await request('GET');if(latest.version!==version){state=latest.state;version=latest.version;message='Planning bijgewerkt';render();}else if(manual){message='Planning is actueel';render();}}
      catch{message='Verbinding met de planning onderbroken. Vernieuw voordat je wijzigingen maakt.';render();}
      finally{busy=false;}
    }
    const refreshTimer=!demo?window.setInterval(()=>{if(!document.hidden)void refresh();},30000):null;
    const personName=id=>state.employees.find(e=>e.id===id)?.name || 'Nog toewijzen';
    const visible=j=>`${j.number} ${j.customer} ${j.machine} ${personName(j.employee)}`.toLowerCase().includes(search.toLowerCase());
    const personnel=()=>state.employees.filter(e=>e.role===(mode==='driver'?'driver':'mechanic') && (!filter || e.id===filter));
    function card(j) {
      const info=mode==='driver'?j.transport:j;
      return `<button type="button" draggable="${canEdit}" data-job="${j.id}" class="hf-job hf-status-${STATUSES.indexOf(j.status)} ${info?.state==='Afgeleverd'?'hf-done':''}" aria-label="Open ${esc(j.number)} ${esc(j.machine)}"><span class="hf-job-meta">${esc(j.number)} <span>${esc(info?.time || '')} · ${info?.duration || 120} min</span></span><strong>${esc(j.machine)}</strong><span>${esc(j.customer)}</span><span class="hf-badge">${esc(mode==='driver'?info?.state||j.status:j.status)}</span></button>`;
    }
    function render() {
      if(config.isActive&&!config.isActive())return;
      let viewRoot=root.querySelector('.hf-view');
      if(!viewRoot){viewRoot=document.createElement('div');viewRoot.className='hf-view';root.replaceChildren(viewRoot);}
      const days=Array.from({length:7},(_,i)=>addDays(week,i));
      const people=personnel();
      const jobs=state.jobs.filter(visible).filter(j=>mode!=='driver' || (j.status==='Klaar voor transport' && j.transport));
      viewRoot.innerHTML=`<div class="hf-banner">${demo?'PROEFVERSIE · Voorbeeldgegevens · Alleen opgeslagen in deze browser':'WERKPLAATS · Gedeelde planning'}<span>Werkbonnen zonder prijzen</span></div>
      <header class="hf-heading"><div><div class="hf-eyebrow">HEFTRUCKS FRIESLAND / EIGEN WERKPLAATSPLANNING</div><h1>Werkplaatsagenda</h1><p>Plan het werk per monteur en draag het over aan de chauffeur.</p></div><button class="hf-primary" data-action="new">＋ Nieuwe werkbon</button></header>
      <div class="hf-summary"><div><strong>${state.jobs.filter(j=>j.status!=='Klaar voor transport').length}</strong> open werkbonnen</div><div><strong>${state.jobs.filter(j=>j.status==='Mee bezig').length}</strong> mee bezig</div><div><strong>${state.jobs.filter(j=>j.status.startsWith('Wachten')).length}</strong> wachten</div><div><strong>${state.jobs.filter(j=>j.status==='Klaar voor transport'&&!j.transport).length}</strong> transport invullen</div></div>
      <div class="hf-toolbar"><div class="hf-tabs"><button data-action="workshop" aria-pressed="${mode==='workshop'}">▦ Monteursagenda</button><button data-action="driver" aria-pressed="${mode==='driver'}">▰ Chauffeursplanning</button></div><div class="hf-tools">${demo?'':'<button data-action="refresh">Vernieuwen</button>'}<button data-action="employees">Medewerkers</button><input aria-label="Zoek werkbonnen" id="hf-search" placeholder="Zoek klant, machine, bon…" value="${esc(search)}"><select id="hf-person" aria-label="Filter medewerker"><option value="">Alle ${mode==='driver'?'chauffeurs':'monteurs'}</option>${options(state.employees.filter(e=>e.role===(mode==='driver'?'driver':'mechanic')),filter)}</select></div></div>
      <div class="hf-weekbar"><div><button data-action="prev" aria-label="Vorige week">←</button><button data-action="today">Deze week</button><button data-action="next" aria-label="Volgende week">→</button></div><h2>${pretty(days[0])} – ${pretty(days[6])} ${week.slice(0,4)}</h2><p>Klik op ＋ om een bon te plannen · sleep een bon om te verplaatsen</p></div>
      <div role="status" class="hf-message">${esc(message)}</div>
      <div class="hf-agenda-wrap"><div class="hf-agenda" style="--hf-rows:${people.length}"><div class="hf-corner">${mode==='driver'?'Chauffeur':'Monteur'}</div>${days.map(d=>`<div class="hf-day ${d===localDate(new Date())?'hf-today':''}"><span>${new Date(d+'T12:00:00').toLocaleDateString('nl-NL',{weekday:'short'})}</span><strong>${pretty(d)}</strong></div>`).join('')}
      ${people.map(p=>`<div class="hf-person"><span>${esc(p.name.slice(0,2).toUpperCase())}</span><strong>${esc(p.name)}</strong><small>${mode==='driver'?'Chauffeur':'Monteur'}</small></div>${days.map(d=>`<section class="hf-cell" data-date="${d}" data-person="${p.id}" aria-label="${esc(p.name)} ${d}">${jobs.filter(j=>(mode==='driver'?j.transport.driver:j.employee)===p.id && (mode==='driver'?j.transport.date:j.date)===d).sort((a,b)=>(mode==='driver'?a.transport.time:a.time).localeCompare(mode==='driver'?b.transport.time:b.time)).map(card).join('')}<button class="hf-add" data-create-date="${d}" data-create-person="${p.id}" aria-label="${mode==='driver'?'Transport plannen':'Nieuwe werkbon'} ${esc(p.name)} ${d}">＋ ${mode==='driver'?'Transport':'Werkbon'}</button></section>`).join('')}`).join('')}</div></div>
      ${!people.length?'<p class="hf-empty">Geen medewerkers in deze selectie. Voeg medewerkers toe of wijzig het filter.</p>':''}
      <section class="hf-backlog"><h2>${mode==='driver'?'Gereed, transport nog invullen':'Nog te plannen'} <span>${mode==='driver'?state.jobs.filter(j=>j.status==='Klaar voor transport'&&!j.transport&&visible(j)).length:state.jobs.filter(j=>(!j.employee||!j.date)&&visible(j)).length}</span></h2><p>${mode==='driver'?'Open een bon om chauffeur, ritdatum en aflevergegevens in te vullen.':'Sleep een bon naar een medewerker en dag, of open de bon om datum en tijd in te vullen.'}</p><div class="hf-backlog-cards">${state.jobs.filter(j=>visible(j)&&(mode==='driver'?j.status==='Klaar voor transport'&&!j.transport:!j.employee||!j.date)).map(j=>{const old=mode;mode='workshop';const html=card(j);mode=old;return html;}).join('') || '<p>Alles is ingepland.</p>'}</div></section>`;
      if(!canEdit){viewRoot.querySelectorAll('[data-action="new"],[data-action="employees"],.hf-add').forEach(e=>e.remove());viewRoot.querySelector('.hf-weekbar p').textContent='Werkplaatstablet · open een bon voor voortgang en notities';viewRoot.querySelector('.hf-backlog>p').textContent='Open een bon om de instructies te lezen.';const badge=document.createElement('strong');badge.className='hf-viewer-badge';badge.textContent='WERKPLAATS';viewRoot.querySelector('.hf-heading').appendChild(badge);}
      bind();
      const orderLink=document.createElement('a');orderLink.className='hf-order-link';orderLink.target='_top';orderLink.href='/werkplaats/bestellingen'+(demo&&!canEdit?'?tablet=1':'');orderLink.textContent='Onderdelen & gereedschap';viewRoot.querySelector('.hf-tabs').appendChild(orderLink);
    }
    function bind() {
      root.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>{
        const action=el.dataset.action;
        if(action==='new')edit();
        if(action==='employees')employeesDialog();
        if(action==='refresh')void refresh(true);
        if(['prev','next','today'].includes(action)){week=action==='today'?weekStart(localDate(new Date())):addDays(week,action==='prev'?-7:7);render();}
        if(['workshop','driver'].includes(action)){mode=action;filter='';render();}
      });
      root.querySelector('#hf-person').onchange=e=>{filter=e.target.value;render();};
      root.querySelector('#hf-search').onchange=e=>{search=e.target.value;render();};
      root.querySelector('#hf-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search=e.target.value;render();}};
      root.querySelectorAll('[data-job]').forEach(el=>{
        el.onclick=()=>edit(state.jobs.find(j=>j.id===el.dataset.job));
        el.ondragstart=e=>{if(!canEdit){e.preventDefault();return;}dragging=el.dataset.job;e.dataTransfer.setData('text/plain',dragging);e.dataTransfer.effectAllowed='move';};
        el.ondragend=()=>{dragging=null;root.querySelectorAll('.hf-over').forEach(c=>c.classList.remove('hf-over'));};
      });
      root.querySelectorAll('[data-create-date]').forEach(el=>el.onclick=()=>{
        if(mode==='driver')transportPicker(el.dataset.createDate,el.dataset.createPerson);
        else edit(null,{date:el.dataset.createDate,employee:el.dataset.createPerson,status:'Ingepland'});
      });
      root.querySelectorAll('.hf-cell').forEach(el=>{
        el.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';el.classList.add('hf-over');};
        el.ondragleave=()=>el.classList.remove('hf-over');
        el.ondrop=async e=>{
          if(!canEdit)return;
          e.preventDefault();el.classList.remove('hf-over');
          const id=dragging;dragging=null;if(!id||busy)return;
          const old=state.jobs.find(j=>j.id===id);if(!old)return;
          if(mode==='driver'&&!old.transport){edit(old,{}, {date:el.dataset.date,driver:el.dataset.person});return;}
          if(mode==='driver'&&old.transport.state==='Afgeleverd'){message='Een afgeleverde rit kan niet worden verplaatst.';render();return;}
          const next=structuredClone(old);
          if(mode==='driver'){next.transport.date=el.dataset.date;next.transport.driver=el.dataset.person;}
          else{next.date=el.dataset.date;next.employee=el.dataset.person;if(next.status==='Nieuw')next.status='Ingepland';}
          if(collision(state.jobs,next,mode==='driver'?'driver':'workshop')){message='Deze medewerker heeft op dat tijdstip al een bon. Open de bon en kies een andere begintijd.';render();return;}
          await commit({...state,jobs:state.jobs.map(j=>j.id===id?next:j)});
        };
      });
    }
    function dialog(html) {
      const previous=document.activeElement;
      const d=document.createElement('dialog');d.className='hf-dialog';d.innerHTML=html;root.appendChild(d);
      if(dialogCount===0){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}dialogCount++;
      d.showModal();
      d.addEventListener('close',()=>{d.remove();dialogCount=Math.max(0,dialogCount-1);if(dialogCount===0)document.body.style.overflow=previousOverflow;if(previous?.isConnected)previous.focus();});
      d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());return d;
    }
    function transportPicker(date, driver) {
      const eligible=state.jobs.filter(j=>j.status==='Klaar voor transport'&&!j.transport);
      const d=dialog(`<h2>Transport plannen</h2><p>Kies een werkbon die klaar is voor transport.</p>${eligible.map(j=>`<button class="hf-pick" data-pick="${j.id}">${esc(j.number)} · ${esc(j.machine)} · ${esc(j.customer)}</button>`).join('')||'<p>Er zijn geen bonnen die nog transportgegevens nodig hebben.</p>'}<button data-close>Sluiten</button>`);
      d.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{d.close();edit(state.jobs.find(j=>j.id===b.dataset.pick),{}, {date,driver});});
    }
    function employeesDialog() {
      const d=dialog(`<h2>Medewerker toevoegen</h2><form>${field('Naam','name','','text','required maxlength="100" autofocus')}<label>Functie<select name="role"><option value="mechanic">Monteur</option><option value="driver">Chauffeur</option></select></label><p class="hf-form-error" role="alert"></p><div class="hf-form-actions"><button type="button" data-close>Sluiten</button><button class="hf-primary">Toevoegen</button></div></form>`);
      d.classList.add('hf-employee-dialog');
      d.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),name=f.get('name').trim();if(!name)return;
        if(state.employees.some(p=>p.name.toLowerCase()===name.toLowerCase()&&p.role===f.get('role'))){d.querySelector('.hf-form-error').textContent='Deze medewerker bestaat al met deze functie.';return;}
        if(await commit({...state,employees:[...state.employees,{id:uid(),name,role:f.get('role')}]}))d.close();else d.querySelector('.hf-form-error').textContent=message;
      };
    }
    function edit(existing, preset={}, transportPreset={}) {
      if(!canEdit&&!existing)return;
      if(!canEdit){viewJob(existing);return;}
      const isNew=!existing;
      const j={id:uid(),number:'Nieuwe bon',customer:'',machine:'',serial:'',task:'',notes:'',employee:'',date:'',time:'08:00',duration:120,status:'Nieuw',checks:[false,false,false],transport:null,...existing,...preset};
      const t={driver:'',date:'',time:'08:00',duration:60,pickup:'Eigen werkplaats',address:'',contact:'',instructions:'',state:'Gepland',confirmation:'',...j.transport,...transportPreset};
      const checks=['Werkzaamheden uitgevoerd','Veiligheid en werking gecontroleerd','Machine en accessoires klaar voor transport'];
      const d=dialog(`<form class="hf-job-form"><div class="hf-dialog-title"><div><div class="hf-eyebrow">WERKBON ZONDER PRIJZEN</div><h2>${esc(j.number)}</h2></div><button type="button" data-close aria-label="Sluiten">✕</button></div><div class="hf-form-grid"><section><h3>Werkplaats</h3><div class="hf-fields">${field('Klant','customer',j.customer,'text','required maxlength="180"')}${field('Machine / vlootnummer','machine',j.machine,'text','required maxlength="180"')}${field('Serienummer','serial',j.serial)}<label>Medewerker<select name="employee"><option value="">Nog toewijzen</option>${options(state.employees.filter(p=>p.role==='mechanic'),j.employee)}</select></label>${field('Datum','date',j.date,'date')}${field('Begintijd','time',j.time,'time','required step="900"')}${field('Duur in minuten','duration',j.duration,'number','required min="15" max="1440" step="15"')}<label>Status<select name="status">${options(STATUSES,j.status)}</select></label></div><label>Werkzaamheden<textarea name="task" required rows="4" maxlength="6000">${esc(j.task)}</textarea></label><div class="hf-checklist">${checks.map((c,i)=>`<label><input type="checkbox" name="check${i}" ${j.checks[i]?'checked':''}>${c}</label>`).join('')}</div><label>Terugkoppeling / onderdelen<textarea name="notes" rows="3" maxlength="6000">${esc(j.notes)}</textarea></label>${activityHtml(j)}</section>
      <section class="hf-transport"><h3>Transport naar de chauffeur</h3><p>Beschikbaar zodra de status <strong>Klaar voor transport</strong> is. Met ingevulde gegevens verschijnt de rit in de chauffeursplanning.</p><fieldset class="hf-transport-fields" ${j.status!=='Klaar voor transport'?'disabled':''}><label class="hf-publish"><input type="checkbox" name="publish" ${j.transport || transportPreset.driver?'checked':''}>Opnemen in chauffeursplanning</label><div class="hf-fields"><label>Chauffeur<select name="driver"><option value="">Kies chauffeur</option>${options(state.employees.filter(p=>p.role==='driver'),t.driver)}</select></label>${field('Transportdatum','transportDate',t.date,'date')}${field('Vertrektijd','transportTime',t.time,'time','step="900"')}${field('Ritduur in minuten','transportDuration',t.duration,'number','min="15" max="1440" step="15"')}</div>${field('Ophaaladres','pickup',t.pickup)}${field('Afleveradres','address',t.address)}${field('Contactpersoon en telefoon','contact',t.contact)}<label>Laad- en afleverinstructies<textarea name="instructions" rows="3" maxlength="6000">${esc(t.instructions)}</textarea></label><label>Ritstatus<select name="transportState">${options(['Gepland','Onderweg','Afgeleverd'],t.state)}</select></label><label>Aflevernotitie / ontvangen door<textarea name="confirmation" rows="2" maxlength="2000">${esc(t.confirmation)}</textarea></label></fieldset></section></div><p role="alert" class="hf-form-error"></p><div class="hf-form-actions">${!isNew?'<button type="button" data-print>Print werkbon</button>':''}<button type="button" data-close>Annuleren</button><button class="hf-primary" type="submit">${isNew?'Werkbon maken':'Wijzigingen opslaan'}</button></div></form>`);
      const form=d.querySelector('form'), transportFields=d.querySelector('fieldset');
      form.elements.status.onchange=()=>{transportFields.disabled=form.elements.status.value!=='Klaar voor transport';};
      function read() {
        const f=new FormData(form), val=n=>String(f.get(n)||'').trim();
        const updated={...j,customer:val('customer'),machine:val('machine'),serial:val('serial'),task:val('task'),notes:val('notes'),employee:val('employee'),date:val('date'),time:val('time'),duration:Number(val('duration')),status:val('status'),checks:checks.map((_,i)=>f.has('check'+i))};
        if(updated.status==='Klaar voor transport'&&f.has('publish')) updated.transport={driver:val('driver'),date:val('transportDate'),time:val('transportTime'),duration:Number(val('transportDuration')),pickup:val('pickup'),address:val('address'),contact:val('contact'),instructions:val('instructions'),state:val('transportState'),confirmation:val('confirmation')};
        else updated.transport=null;
        return updated;
      }
      if(!isNew)d.querySelector('[data-print]').onclick=()=>{if(!canEdit)printJob(j);else if(form.reportValidity())printJob(read());};
      form.onsubmit=async e=>{
        e.preventDefault();if(busy)return;
        const updated=read(),err=d.querySelector('.hf-form-error');
        const fail=text=>{err.textContent=text;err.scrollIntoView({block:'nearest'});};
        if(updated.status!=='Nieuw'&&(!updated.employee||!updated.date))return fail('Kies een monteur en datum voor deze status.');
        if(Boolean(updated.employee)!==Boolean(updated.date))return fail('Vul zowel een monteur als een datum in, of laat beide leeg voor een nieuwe bon.');
        if(updated.status==='Klaar voor transport'&&!updated.checks.every(Boolean))return fail('Vink eerst alle drie de werkplaatscontroles af.');
        if(minutes(updated.time)+updated.duration>1440)return fail('De werkplaatsopdracht moet binnen dezelfde dag vallen.');
        if(collision(state.jobs,updated,'workshop'))return fail('Deze monteur heeft op dat tijdstip al een bon. Kies een andere begintijd.');
        if(updated.transport){const tr=updated.transport;if(!tr.driver||!tr.date||!tr.time||!tr.pickup||!tr.address||!tr.contact)return fail('Vul chauffeur, transportdatum, vertrektijd, ophaaladres, afleveradres en contactpersoon in.');if(tr.duration<15||tr.duration>1440||tr.duration%15||minutes(tr.time)+tr.duration>1440)return fail('Vul een geldige ritduur in die binnen dezelfde dag valt.');if(tr.state==='Afgeleverd'&&!tr.confirmation)return fail('Noteer bij aflevering wie de machine heeft ontvangen.');if(collision(state.jobs,updated,'driver'))return fail('Deze chauffeur heeft op dat tijdstip al een rit.');}
        if(isNew)updated.number=`WB-${String(Math.max(0,...state.jobs.map(x=>Number(x.number.slice(3))||0))+1).padStart(4,'0')}`;
        const submit=form.querySelector('[type=submit]');submit.disabled=true;
        const ok=await commit({...state,jobs:isNew?[...state.jobs,updated]:state.jobs.map(x=>x.id===updated.id?updated:x)});
        if(ok)d.close();else{submit.disabled=false;fail(message);}
      };
    }
    function activityHtml(j) {
      const labels={start:'Gestart',pause:'Pauze',parts:'Wachten op onderdelen',review:'Afronden / werkbon-controle',hold:'On hold',note:'Notitie'};
      return (j.updates||[]).length?'<h3>Werkplaatsupdates</h3><div class="hf-updates">'+j.updates.slice().reverse().map(u=>'<article><strong>'+esc(u.employeeName)+' · '+esc(labels[u.action]||u.action)+'</strong><small>'+esc(new Date(u.at).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'}))+'</small>'+(u.text?'<p class="hf-readable">'+esc(u.text)+'</p>':'')+'</article>').join('')+'</div>':'';
    }
    function viewJob(j) {
      const t=j.transport,free=!!j.date&&!!j.employee&&!t&&j.status!=='Klaar voor transport';
      const actions=[['start','▶ Start','Mee bezig'],['pause','⏸ Pauze','Pauze'],['parts','Wachten op onderdelen','Wachten op onderdelen'],['review','✓ Afronden / controle','Werkbon-controle'],['hold','On hold','On hold']];
      const header='<div class="hf-dialog-title"><div><div class="hf-eyebrow">WERKPLAATS</div><h2>'+esc(j.number)+' · '+esc(j.machine)+'</h2><p>Status: <strong>'+esc(j.status)+'</strong></p></div><button data-close aria-label="Sluiten">✕</button></div>';
      const info='<section><h3>'+esc(j.customer)+'</h3><p><strong>Monteur:</strong> '+esc(personName(j.employee))+'<br><strong>Planning:</strong> '+pretty(j.date)+' '+esc(j.time)+'<br><strong>Serienummer:</strong> '+(esc(j.serial)||'—')+'</p><h3>Werkzaamheden</h3><p class="hf-readable">'+esc(j.task)+'</p>'+(j.notes?'<h3>Terugkoppeling / onderdelen</h3><p class="hf-readable">'+esc(j.notes)+'</p>':'')+activityHtml(j)+'</section>';
      const controls='<section class="hf-worklog-panel"><h3>Voortgang doorgeven</h3><form class="hf-worklog-form"><label>Jouw naam<select name="employeeId" required><option value="">Kies je naam</option>'+options(state.employees,j.employee)+'</select></label><label>Notitie<textarea name="text" rows="4" maxlength="3000" placeholder="Wat heb je gedaan of wat is er nodig?"></textarea></label><div class="hf-worklog-actions">'+actions.map(([action,label,status])=>'<button type="submit" name="action" value="'+action+'" '+(!free||j.status===status||(action==='pause'&&j.status!=='Mee bezig')?'disabled':'')+'>'+label+'</button>').join('')+'</div>'+(!free?'<p>Alleen notities mogelijk: deze bon is nog niet ingepland of is al vrijgegeven voor transport.</p>':'')+'<p class="hf-form-error" role="alert"></p><button class="hf-primary" type="submit" name="action" value="note">Notitie toevoegen</button></form>'+(t?'<h3>Voor de chauffeur</h3><p><strong>'+esc(personName(t.driver))+'</strong> · '+pretty(t.date)+' '+esc(t.time)+'<br>'+esc(t.pickup)+' → '+esc(t.address)+'<br>'+esc(t.contact)+'</p><p class="hf-readable">'+esc(t.instructions)+'</p>':'')+'</section>';
      const d=dialog(header+'<div class="hf-form-grid hf-reading">'+info+controls+'</div><div class="hf-form-actions"><button data-print>Print werkbon</button><button data-close>Sluiten</button></div>');
      d.querySelector('[data-print]').onclick=()=>printJob(j);
      const form=d.querySelector('form');let retryKey='',retryId='';
      form.onsubmit=async e=>{
        e.preventDefault();if(busy)return;
        const f=new FormData(form),action=e.submitter?.value||'note',employeeId=String(f.get('employeeId')||''),text=String(f.get('text')||'').trim(),err=form.querySelector('.hf-form-error');
        if(action==='note'&&!text){err.textContent='Vul een notitie in.';return;}
        const payloadKey=JSON.stringify({employeeId,action,text});if(payloadKey!==retryKey){retryKey=payloadKey;retryId=uid();}
        const payload={jobId:j.id,employeeId,action,text,requestId:retryId};
        const disabledButtons=Array.from(form.querySelectorAll('button')).map(b=>[b,b.disabled]);disabledButtons.forEach(([b])=>b.disabled=true);busy=true;err.textContent='';
        try{
          if(demo){const employee=state.employees.find(p=>p.id===employeeId);if(!employee)throw new Error('Kies je naam.');const current=state.jobs.find(p=>p.id===j.id);if(!current)throw new Error('Werkbon niet gevonden.');if(action!=='note'&&!free)throw new Error('Deze status kan niet op de tablet worden gewijzigd.');const statuses={start:'Mee bezig',pause:'Pauze',parts:'Wachten op onderdelen',review:'Werkbon-controle',hold:'On hold'};const changed={...current,status:action==='note'?current.status:statuses[action],updates:[...(current.updates||[]),{id:retryId,employeeId,employeeName:employee.name,action,text,at:new Date().toISOString()}]};const next={...state,jobs:state.jobs.map(p=>p.id===j.id?changed:p)};localStorage.setItem(storageKey,JSON.stringify(next));state=next;}
          else{const result=await request('POST',payload,'/api/werkplaats/werkbon');state=result.state;version=result.version;}
          busy=false;message='Voortgang opgeslagen';render();d.close();viewJob(state.jobs.find(p=>p.id===j.id));
        }catch(error){err.textContent=error.message||'Bijwerken is niet gelukt.';disabledButtons.forEach(([b,disabled])=>b.disabled=disabled);}
        finally{busy=false;}
      };
    }
    function printJob(j) {
      const print=document.createElement('article');print.className='hf-print';
      print.innerHTML=`<header><strong>HEFTRUCKS FRIESLAND</strong><span>${esc(j.number)} · WERKBON</span></header><h1>${esc(j.machine)}</h1><h2>${esc(j.customer)}</h2><p>Serienummer: ${esc(j.serial)}<br>Monteur: ${esc(personName(j.employee))}<br>Planning: ${pretty(j.date)} ${esc(j.time)} · ${j.duration} minuten<br>Status: ${esc(j.status)}</p><h3>Werkplaatsinstructie</h3><p>${esc(j.task)}</p>${['Werkzaamheden uitgevoerd','Veiligheid en werking gecontroleerd','Machine en accessoires transportklaar'].map((c,i)=>`<p>${j.checks[i]?'☑':'☐'} ${c}</p>`).join('')}<h3>Terugkoppeling / onderdelen</h3><p>${esc(j.notes)||'___________________________________________________'}</p>${activityHtml(j)}<h3>Transport en aflevering</h3>${j.transport?`<p>Chauffeur: ${esc(personName(j.transport.driver))}<br>Vertrek: ${pretty(j.transport.date)} ${esc(j.transport.time)}<br>Ophalen: ${esc(j.transport.pickup)}<br>Afleveren: ${esc(j.transport.address)}<br>Contact: ${esc(j.transport.contact)}</p><p>${esc(j.transport.instructions)}</p><p>Ritstatus: ${esc(j.transport.state)}<br>${esc(j.transport.confirmation)}</p>`:'<p>Transport nog niet ingepland.</p>'}<p class="hf-sign">Datum: __________________ Naam / handtekening: __________________</p><footer>Werkbon zonder prijzen ${demo?'· Proefversie':''}</footer>`;
      document.body.appendChild(print);document.body.classList.add('hf-printing');
      const cleanup=()=>{print.remove();document.body.classList.remove('hf-printing');};
      window.addEventListener('afterprint',cleanup,{once:true});try{window.print();}finally{cleanup();}
    }
    render();
    return ()=>{if(refreshTimer)window.clearInterval(refreshTimer);root.querySelectorAll('dialog').forEach(d=>{if(d.open)d.close();d.remove();});if(dialogCount>0){dialogCount=0;document.body.style.overflow=previousOverflow;}};
  }
})();
