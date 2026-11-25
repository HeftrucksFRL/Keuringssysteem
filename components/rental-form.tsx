"use client";
import {useEffect,useRef,useState} from 'react';
import {useFormStatus} from 'react-dom';
import {CustomerPicker} from './customer-picker';
import {getCsrfHeaders} from '@/lib/client-security';
import {todayLocalIso} from '@/lib/utils';
import type {CustomerRecord,MachineRecord,RentalRecord} from '@/lib/domain';
import {createRentalAction,completeRentalAction,updateRentalDetailsAction} from '@/app/verhuur/actions';
import './rental-form.css';

function SaveButton({children}:{children:React.ReactNode}){const {pending}=useFormStatus();return <button className="button" disabled={pending} type="submit">{pending?'Opslaan…':children}</button>;}
export function RentalTransportFields({rental}:{rental?:RentalRecord}){
 return <fieldset style={{marginTop:16}}><legend>Transport (optioneel)</legend>
  <label><input type="checkbox" name="transportDelivery" defaultChecked={rental?.transport?.delivery}/> Machine door ons laten brengen</label>{' '}
  <label><input type="checkbox" name="transportCollection" defaultChecked={rental?.transport?.collection}/> Machine door ons laten ophalen</label>
  <p className="muted">Zonder vinkje ontstaat geen transportbon. Ophalen kan later worden toegevoegd, ook bij een open huurperiode.</p>
  <div className="form-grid-wide">
   <label>Adres bij klant<input name="transportAddress" maxLength={6000} defaultValue={rental?.transport?.address}/></label>
   <label>Contactpersoon / telefoon<input name="transportContact" maxLength={6000} defaultValue={rental?.transport?.contact}/></label>
   <label>Transportinstructies<textarea name="transportInstructions" maxLength={6000} defaultValue={rental?.transport?.instructions}/></label>
  </div>
 </fieldset>;
}
export function RentalPeriodFields({rental}:{rental?:RentalRecord}){
 const [open,setOpen]=useState(rental? !rental.endDate:false);
 return <><label>Startdatum<input name="startDate" type="date" required defaultValue={rental?.startDate||todayLocalIso()}/></label>
  <label><input type="checkbox" name="openPeriod" checked={open} onChange={e=>setOpen(e.target.checked)}/> Open huurperiode / einddatum onbekend</label>
  <label>Einddatum<input name="endDate" type="date" required={!open} disabled={open} defaultValue={rental?.endDate||todayLocalIso()}/></label>
 </>;
}
export function RentalForm({customers,stockMachines,defaultMachineId='',returnTo='/verhuur'}:{customers:CustomerRecord[];stockMachines:MachineRecord[];defaultMachineId?:string;returnTo?:string}){
 const [customerList,setCustomers]=useState(customers),[selected,setSelected]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[requestId,setRequestId]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>setRequestId(crypto.randomUUID()),[]);
 async function addCustomer(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(saving)return;setSaving(true);setError('');const values=Object.fromEntries(new FormData(e.currentTarget));
  try{const response=await fetch('/api/werkplaats/relaties',{method:'POST',headers:{'Content-Type':'application/json',...getCsrfHeaders()},body:JSON.stringify({...values,kind:'customer'})});const result=await response.json();if(!response.ok)throw new Error(result.message||'Klant opslaan mislukt.');
   const customer={...values,id:result.id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as unknown as CustomerRecord;
   setCustomers(list=>[...list,customer]);setSelected(customer.id);dialog.current?.close();
  }catch(e){setError(e instanceof Error?e.message:'Klant opslaan mislukt.');}finally{setSaving(false);}
 }
 return <><form action={createRentalAction} className="rental-form">
  <input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="returnTo" value={returnTo}/>
  <div className="form-grid-wide"><label>Voorraadmachine<select name="machineId" required defaultValue={defaultMachineId}><option value="" disabled>Kies een machine uit de voorraad</option>{stockMachines.map(machine=><option key={machine.id} value={machine.id}>{machine.internalNumber||machine.machineNumber} · {machine.brand} {machine.model}</option>)}</select></label>
   <CustomerPicker key={selected} customers={customerList} defaultCustomerId={selected} label="Verhuren aan klant" required/>
   <button type="button" className="button-secondary" onClick={()=>dialog.current?.showModal()}>＋ Nieuwe klant</button>
   <RentalPeriodFields/><label>Prijs<input name="price" placeholder="Bijv. EUR 350 totaal"/></label>
  </div><RentalTransportFields/><div className="actions"><SaveButton>Start verhuur</SaveButton></div>
 </form>
 <dialog ref={dialog} className="rental-customer-dialog" onCancel={()=>setError('')}><form onSubmit={addCustomer}><h2>Nieuwe klant</h2><p>De klant wordt opgeslagen in het gezamenlijke klantenbestand.</p>
  {([['companyName','Bedrijfsnaam'],['address','Adres'],['city','Plaats'],['contactName','Contactpersoon'],['phone','Telefoon'],['email','E-mailadres']] as const).map(([name,label])=><label key={name}>{label}<input name={name} type={name==='email'?'email':'text'} required={name==='companyName'} maxLength={name==='email'?254:180}/></label>)}
  {error&&<p role="alert">{error}</p>}<div className="actions"><button type="button" className="button-secondary" disabled={saving} onClick={()=>dialog.current?.close()}>Annuleren</button><button className="button" disabled={saving}>{saving?'Opslaan…':'Klant opslaan en kiezen'}</button></div>
 </form></dialog></>;
}
export function RentalCompletionForm({rental,returnTo='/verhuur'}:{rental:RentalRecord;returnTo?:string}){
 return <form action={completeRentalAction} className="rental-form rental-completion"><input type="hidden" name="rentalId" value={rental.id}/><input type="hidden" name="machineId" value={rental.machineId}/><input type="hidden" name="version" value={rental.version||1}/><input type="hidden" name="returnTo" value={returnTo}/>
  <label>Werkelijke einddatum<input type="date" name="endDate" required min={rental.startDate} max={todayLocalIso()} defaultValue={rental.endDate&&rental.endDate<=todayLocalIso()?rental.endDate:todayLocalIso()}/></label><SaveButton>Verhuur afsluiten</SaveButton>
 </form>;
}
export function RentalDetailsForm({rental}:{rental:RentalRecord}){
 return <form action={updateRentalDetailsAction} className="rental-form"><input type="hidden" name="rentalId" value={rental.id}/><input type="hidden" name="version" value={rental.version||1}/><input type="hidden" name="customerId" value={rental.customerId}/>
  <div className="form-grid-wide"><RentalPeriodFields rental={rental}/><label>Prijs<input name="price" defaultValue={rental.price}/></label></div><RentalTransportFields rental={rental}/><SaveButton>Verhuur en transport opslaan</SaveButton>
 </form>;
}
