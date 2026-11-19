import type {MachineRecord} from './domain';
import type {WorkshopJob} from './workshop';

export function workshopMachineSnapshot(machine:Pick<MachineRecord,'brand'|'model'|'internalNumber'|'serialNumber'|'configuration'>){
  return {machine:[machine.brand,machine.model].filter(Boolean).join(' · '),internalNumber:machine.internalNumber||'',serial:machine.serialNumber||'',hourReading:machine.configuration.hour_reading||''};
}
// Only an explicit new/changed reading updates the machine. Moving an older
// work order must never restore that work order's historical meter reading.
export function workshopHourReadingChange(previous:WorkshopJob|undefined,next:WorkshopJob){
  if(!next.machineId||!next.hourReading?.trim())return null;
  if(previous?.machineId===next.machineId&&previous.hourReading===next.hourReading)return null;
  if(!/^\d+(?:[.,]\d+)?$/.test(next.hourReading.trim()))throw new Error('Vul een geldige, positieve urenstand in.');
  return {machineId:next.machineId,hourReading:next.hourReading.trim()};
}
