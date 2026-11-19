import {PDFDocument, StandardFonts, rgb, type PDFPage} from 'pdf-lib';
import {z} from 'zod';
import {workshopCheckLabels} from './workshop';

const text=z.string().max(6000).optional().default('');
const record=z.object({number:z.string().max(100).optional().default(''),customer:text,machine:text,serial:text,employee:text,date:text,time:text,hourReading:text,deliveryAddress:text,task:text,usedParts:text,notes:text,estimatedMinutes:z.number().min(0).max(1440).optional(),actualMinutes:z.number().min(0).max(600000).optional(),requiredChecks:z.array(z.boolean()).max(10).optional(),checkedPoints:z.array(z.boolean()).max(10).optional(),title:text,pickup:text,address:text,contact:text,driver:text,appointmentTime:text,instructions:text,confirmation:text,position:z.number().optional()});
export const workshopPrintSchema=z.object({type:z.enum(['workshop','transport','trips']),item:record.optional(),items:z.array(record).max(300).optional()});
export type WorkshopPrintInput=z.input<typeof workshopPrintSchema>;

// The same worksheet renderer handles blank and populated forms. No workflow
// history, prices or status is part of this deliberately limited print model.
export async function createWorkshopPdf(input:WorkshopPrintInput){
  const data=workshopPrintSchema.parse(input), doc=await PDFDocument.create();
  const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const margin=32,width=531,ink=rgb(.08,.11,.14),rule=rgb(.48,.51,.54);
  let page:PDFPage,y=0;
  const clean=(value:string)=>Array.from(value.replace(/[\u2010-\u2015]/g,'-')).map(c=>{try{regular.encodeText(c);return c;}catch{return '?';}}).join('');
  function write(value:string,x:number,top:number,size=10,heavy=false){page.drawText(clean(value),{x,y:842-top-size,size,font:heavy?bold:regular,color:ink});}
  function line(x:number,top:number,w:number){page.drawLine({start:{x,y:842-top},end:{x:x+w,y:842-top},thickness:.5,color:rule});}
  function box(x:number,top:number,w:number,h:number){page.drawRectangle({x,y:842-top-h,width:w,height:h,borderWidth:.5,borderColor:rule});}
  function check(x:number,top:number,checked=false){box(x,top,9,9);if(checked){page.drawLine({start:{x:x+2,y:842-top-4},end:{x:x+4,y:842-top-7},thickness:1,color:ink});page.drawLine({start:{x:x+4,y:842-top-7},end:{x:x+8,y:842-top-2},thickness:1,color:ink});}}
  function newPage(title:string){page=doc.addPage([595,842]);y=margin;write('HEFTRUCKS FRIESLAND',margin,y,10,true);y+=20;for(const t of wrap(title,width,20)){write(t,margin,y,20,true);y+=24;}y+=6;line(margin,y,width);y+=10;}
  function ensure(h:number){if(y+h>810)newPage('Vervolg');}
  function wrap(value:string,w:number,size=10){const result:string[]=[];for(const paragraph of value.split(/\r?\n/)){let current='';for(const word of clean(paragraph).split(/\s+/)){let part='';const pieces:string[]=[];for(const c of word){if(regular.widthOfTextAtSize(part+c,size)>w){pieces.push(part);part='';}part+=c;}pieces.push(part);for(const piece of pieces){const next=current?current+' '+piece:piece;if(regular.widthOfTextAtSize(next,size)>w&&current){result.push(current);current=piece;}else current=next;}}result.push(current);}return result;}
  function section(label:string,value:string,minHeight:number){const lines=wrap(value,width-14);for(let offset=0;offset<lines.length;offset+=48){const chunk=lines.slice(offset,offset+48),h=Math.max(offset?26:minHeight,chunk.length*12+12);ensure(h+26);write(label+(offset?' (vervolg)':''),margin,y,10,true);y+=17;box(margin,y,width,h);chunk.forEach((t,i)=>write(t,margin+7,y+6+i*12));if(!value)for(let k=22;k<h;k+=20)line(margin+7,y+k,width-14);y+=h+9;}}
  function fields(entries:[string,string][]) {for(let i=0;i<entries.length;i+=2){const pair=entries.slice(i,i+2);const h=Math.max(30,...pair.map(([,v])=>18+wrap(v,248,10).length*12));if(h>300){pair.forEach(([label,value])=>section(label,value,30));continue;}ensure(h);pair.forEach(([label,value],col)=>{const x=margin+col*270;write(label,x,y,8,true);wrap(value,248).forEach((t,k)=>write(t,x+2,y+12+k*12));line(x,y+h-3,255);});y+=h+3;}}
  const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)?s.split('-').reverse().join('-'):s;
  const item=data.item||record.parse({});
  if(data.type==='workshop'){
    newPage('Werkbon'+(item.number?' '+item.number:''));
    fields([['Datum',date(item.date)],['Naam monteur',item.employee],['Klant / bedrijf',item.customer],['Machine / machinenummer',item.machine],['Serienummer',item.serial],['Urenstand machine',item.hourReading],['Afleveradres',item.deliveryAddress],['Begintijd / richttijd (uren)',[item.time,item.estimatedMinutes===undefined?'':String(item.estimatedMinutes/60)+' uur'].filter(Boolean).join(' / ')]]);
    section('Werkzaamheden / bevindingen',item.task,64);
    const parts=wrap(item.usedParts,width-90,9);const rowCount=Math.max(10,item.usedParts?parts.length+5:10);ensure(20+Math.min(rowCount,10)*19);write('Gebruikte onderdelen',margin,y,10,true);y+=17;
    box(margin,y,width,18);write('Aantal',margin+6,y+3,9,true);write('Omschrijving / artikelnummer',margin+65,y+3,9,true);y+=18;
    for(let i=0;i<rowCount;i++){if(y+19>810){newPage('Gebruikte onderdelen (vervolg)');box(margin,y,width,18);write('Aantal',margin+6,y+3,9,true);write('Omschrijving / artikelnummer',margin+65,y+3,9,true);y+=18;}box(margin,y,58,19);box(margin+58,y,width-58,19);if(parts[i])write(parts[i],margin+65,y+4,9);y+=19;}y+=9;
    fields([['Totaal gewerkte uren',item.actualMinutes===undefined?'':String(item.actualMinutes/60)],['Naam / paraaf monteur','']]);
    ensure(102);write('Check-up',margin,y,10,true);y+=16;write('Eerste vakje: te controleren - tweede vakje: gecheckt door monteur',margin,y,8);y+=17;
    workshopCheckLabels.forEach((label,i)=>{const x=margin+(i%2)*270,top=y+Math.floor(i/2)*16;check(x,top,!!item.requiredChecks?.[i]);check(x+15,top,!!item.checkedPoints?.[i]);write(label,x+30,top,8);});y+=85;
    section('Opmerkingen monteur',item.notes,26);
    ensure(26);check(margin,y+3);write('Kantoorcontrole',margin+16,y+2,10,true);write('Naam / paraaf:',margin+160,y+2,9);line(margin+230,y+20,120);write('Datum:',margin+370,y+2,9);line(margin+410,y+20,121);
  }else if(data.type==='transport'){
    newPage('Transportbon');
    fields([['Omschrijving',item.title],['Werkbon',item.number],['Datum',date(item.date)],['Chauffeur',item.driver],['Klant / leverancier',item.customer],['Machine',item.machine],['Contactpersoon / telefoon',item.contact],['Afgesproken tijd (optioneel)',item.appointmentTime]]);
    section('Ophaaladres',item.pickup,64);section('Afleveradres',item.address,64);section('Voorbereiding / laad- en afleverinstructies',item.instructions,110);section('Afleverbevestiging / opmerkingen',item.confirmation,90);
    fields([['Naam ontvanger',''],['Datum / tijd aflevering',''],['Handtekening ontvanger',''],['Naam / paraaf chauffeur','']]);
  }else{
    newPage('Ritlijst');
    const items=[...(data.items||[])].sort((a,b)=>a.date.localeCompare(b.date)||a.driver.localeCompare(b.driver)||(a.position||0)-(b.position||0));
    let group='',n=0;
    for(const t of items){const key=t.date+'|'+t.driver;if(key!==group){ensure(90);group=key;n=0;write(date(t.date)+' - '+t.driver,margin,y,13,true);y+=26;}
      const title=wrap(String(++n)+'. '+t.title,width,11);ensure(120);for(const text of title){ensure(17);write(text,margin,y,11,true);y+=17;}y+=3;
      fields([['Klant / machine',[t.customer,t.machine].filter(Boolean).join(' / ')],['Afgesproken tijd',t.appointmentTime],['Ophalen',t.pickup],['Afleveren',t.address],['Contact',t.contact],['Afgetekend / opmerkingen','']]);
      if(t.instructions)section('Instructies',t.instructions,24);y+=12;
    }
    if(!items.length)write('Geen geplande ritten in deze selectie.',margin,y);
  }
  doc.setTitle(data.type==='workshop'?'Werkbon'+(item.number?' '+item.number:''):data.type==='transport'?'Transportbon':'Ritlijst');doc.setAuthor('Heftrucks Friesland');
  doc.getPages().forEach((p,i)=>{page=p;write(`${i+1} / ${doc.getPageCount()}`,width,823,8);});
  return doc.save();
}
