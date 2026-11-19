import {formatLocalDateInput} from './utils';
export function inspectionListScope(params:{week?:string;period?:string;status?:string}={},now=new Date()){
  const scope:{from?:string;to?:string;status?:string}={};
  const add=(from:string,to:string)=>{scope.from=scope.from&&scope.from>from?scope.from:from;scope.to=scope.to&&scope.to<to?scope.to:to;};
  if(params.week==='current'||params.period==='week'){const monday=new Date(now);monday.setDate(monday.getDate()-(monday.getDay()+6)%7);const sunday=new Date(monday);sunday.setDate(sunday.getDate()+6);add(formatLocalDateInput(monday),formatLocalDateInput(sunday));}
  if(params.period==='month'){const prefix=now.toISOString().slice(0,7),end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)).toISOString().slice(0,10);add(prefix+'-01',end);}
  if(params.period==='day'){const day=now.toISOString().slice(0,10);add(day,day);}
  if(params.status==='draft')scope.status='draft';
  return scope;
}
