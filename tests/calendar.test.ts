import {test} from "node:test";
import assert from "node:assert/strict";
import {isoWeek,dutchHolidays,agendaRangeSchema,agendaDays,packAgendaDescription,unpackAgendaDescription} from "../lib/calendar";
test("ISO week numbers handle the first and last days of a week-year",()=>{
 for(const [date,year,week] of [["2021-01-01",2020,53],["2021-01-04",2021,1],["2026-12-31",2026,53],["2027-01-01",2026,53],["2027-01-04",2027,1],["2026-11-18",2026,47]] as const)assert.deepEqual(isoWeek(date),{year,week});
});
test("Dutch holidays follow Easter each year and King's Day moves off Sunday",()=>{
 const h=(year:number,name:string)=>dutchHolidays(year).find(h=>h.name===name)?.date;
 assert.equal(h(2026,"Eerste paasdag"),"2026-04-05");assert.equal(h(2026,"Goede Vrijdag"),"2026-04-03");assert.equal(h(2026,"Hemelvaartsdag"),"2026-05-14");assert.equal(h(2026,"Tweede pinksterdag"),"2026-05-25");
 assert.equal(h(2027,"Eerste paasdag"),"2027-03-28");assert.equal(h(2027,"Hemelvaartsdag"),"2027-05-06");assert.equal(h(2027,"Tweede pinksterdag"),"2027-05-17");assert.equal(h(2025,"Koningsdag"),"2025-04-26");assert.equal(h(2027,"Tweede kerstdag"),"2027-12-26");
});
test("free appointments span every inclusive day across month and DST boundaries",()=>{
 assert.deepEqual(agendaDays({eventDate:"2027-03-26",endDate:"2027-04-02"},"2027-03-28","2027-03-31"),["2027-03-28","2027-03-29","2027-03-30","2027-03-31"]);
 assert.deepEqual(agendaDays({eventDate:"2027-03-26",endDate:"2027-04-02"},"2027-04-01","2027-04-30"),["2027-04-01","2027-04-02"]);
 assert.deepEqual(agendaDays({eventDate:"2027-05-01"},"2027-04-01","2027-04-30"),[]);
});
test("range validation rejects reversed dates, impossible dates, missing times and reversed same-day times",()=>{
 const valid={eventDate:"2027-04-01",endDate:"2027-04-08",startTime:"09:00",endTime:"17:00"};assert.equal(agendaRangeSchema.safeParse(valid).success,true);
 for(const change of [{endDate:"2027-03-31"},{eventDate:"2027-02-30"},{startTime:"25:00"},{endTime:""},{endDate:"2027-04-01",endTime:"08:00"}])assert.equal(agendaRangeSchema.safeParse({...valid,...change}).success,false);
 assert.equal(agendaRangeSchema.safeParse({...valid,startTime:"",endTime:""}).success,true);
});
test("range persistence preserves descriptions, times and legacy plain appointments without a schema migration",()=>{
 const range={eventDate:"2027-04-01",endDate:"2027-04-08",startTime:"09:00",endTime:"17:00"};
 assert.deepEqual(unpackAgendaDescription(packAgendaDescription("Vakantie\nNotitie",range),range.eventDate),{...range,description:"Vakantie\nNotitie"});
 assert.deepEqual(unpackAgendaDescription("Bestaande afspraak",range.eventDate),{eventDate:range.eventDate,endDate:range.eventDate,startTime:"",endTime:"",description:"Bestaande afspraak"});
 assert.equal(unpackAgendaDescription("KS_AGENDA_RANGE_V1:not json",range.eventDate).description,"KS_AGENDA_RANGE_V1:not json");
});
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
test("standalone calendar runtime agrees with the app across year boundaries and Easter dates",()=>{
 const sandbox:{window:{HFCalendar?:{isoWeek:typeof isoWeek;dutchHolidays:typeof dutchHolidays}}}={window:{}};
 runInNewContext(readFileSync(new URL("../modules/werkplaats/assets/calendar.js",import.meta.url),"utf8"),sandbox);
 const runtime=sandbox.window.HFCalendar!;
 for(let year=2024;year<=2035;year++){
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.dutchHolidays(year))),dutchHolidays(year));
  for(const day of [year+"-01-01",year+"-01-04",year+"-12-31"])assert.deepEqual(JSON.parse(JSON.stringify(runtime.isoWeek(day))),isoWeek(day));
 }
});
