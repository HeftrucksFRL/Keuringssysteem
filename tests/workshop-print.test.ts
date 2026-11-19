import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,PDFArray,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {createWorkshopPdf,workshopPrintSchema} from '../lib/workshop-print';
import {workshopViewerRequestAllowed} from '../lib/workshop-access';
async function read(input:Parameters<typeof createWorkshopPdf>[0]){
  const pdf=await PDFDocument.load(await createWorkshopPdf(input));
  const text=pdf.getPages().map(page=>{const streams=page.node.Contents();const entries=streams instanceof PDFArray?streams.asArray():[streams];return entries.map(ref=>{const stream=pdf.context.lookup(ref!);if(!(stream instanceof PDFRawStream))return '';return Buffer.from(decodePDFRawStream(stream).decode()).toString().replace(/<([0-9A-F]+)>/g,(_,hex)=>Buffer.from(hex,'hex').toString('latin1'));}).join('\n');}).join('\n');
  return {pdf,text};
}
test('blank and populated work orders share a one-page paper worksheet with checkboxes and ten parts rows',async()=>{
  for(const item of [undefined,{number:'WB-0001',customer:'De Boer',machine:'Linde E20',internalNumber:'254',task:'Kantelaar demonteren\nSlangen vervangen',usedParts:'2 slangen\n1 filter',requiredChecks:[true]}]){
    const {pdf,text}=await read({type:'workshop',item});assert.equal(pdf.getPageCount(),1);assert.match(text,/Gebruikte onderdelen/);assert.match(text,/Kantoorcontrole/);assert.match(text,/Veiligheid en eindcontrole/);assert.doesNotMatch(text,/Nog niet ingevuld|Werkplaatsupdates|Status:|zonder prijzen|https:/);
    if(item){assert.match(text,/Intern nummer/);assert.match(text,/254/);assert.doesNotMatch(text,/Machine \/ machinenummer/);assert.match(text,/Kantelaar demonteren/);assert.match(text,/Slangen vervangen/);assert.doesNotMatch(text,/demonteren\?Slangen/);assert.equal(pdf.getTitle(),'Werkbon WB-0001');}
  }
});
test('long work instructions continue across pages without truncating the final line',async()=>{
  const {pdf,text}=await read({type:'workshop',item:{task:Array.from({length:120},(_,i)=>'Werkregel '+i).join('\n')}});assert.ok(pdf.getPageCount()>1);assert.match(text,/Werkregel 119/);assert.match(text,/Kantoorcontrole/);
});
test('transport form has writable confirmation and trip lists follow day, driver and position rather than time',async()=>{
  const transport=await read({type:'transport',item:{title:'Truck ophalen'}});assert.match(transport.text,/Handtekening ontvanger/);assert.doesNotMatch(transport.text,/Nog te plannen|Status/);
  const trips=await read({type:'trips',items:[{date:'2026-11-19',driver:'Harm',title:'Tweede rit',position:2,appointmentTime:'08:00'},{date:'2026-11-19',driver:'Harm',title:'Eerste rit',position:1,appointmentTime:'14:00'}]});assert.ok(trips.text.indexOf('Eerste rit')<trips.text.indexOf('Tweede rit'));assert.match(trips.text,/14:00/);
});
test('print snapshots discard workflow data and permit only authenticated print methods for tablets',()=>{
  const parsed=workshopPrintSchema.parse({type:'workshop',item:{status:'On hold',updates:[{text:'Private update'}]}});assert.equal('status' in parsed.item!,false);assert.equal('updates' in parsed.item!,false);
  assert.equal(workshopViewerRequestAllowed('/api/werkplaats/print','POST'),true);assert.equal(workshopViewerRequestAllowed('/api/werkplaats/print','DELETE'),false);assert.equal(workshopPrintSchema.safeParse({type:'trips',items:Array(301).fill({})}).success,false);
});
