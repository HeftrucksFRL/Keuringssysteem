import {test} from "node:test";
import assert from "node:assert/strict";
import {orderRequestSchema,orderUpdateSchema,orderNeedsPurchase,orderIsOpen} from "../lib/workshop-orders";
const request={id:"11111111-1111-4111-8111-111111111111",item:"Kwasten",category:"Verbruiksmateriaal",quantity:3,unit:"stuks",employeeId:"jelle",jobId:"",needBy:"",urgency:"Normaal",partNumber:"",notes:"Voor schoonmaken"};
test("order requests accept workshop supplies and validate amounts and dates",()=>{
  assert.equal(orderRequestSchema.safeParse(request).success,true);
  for(const quantity of [0,-1,Infinity,100001])assert.equal(orderRequestSchema.safeParse({...request,quantity}).success,false);
  assert.equal(orderRequestSchema.safeParse({...request,needBy:"2026-02-30"}).success,false);
  assert.equal(orderRequestSchema.safeParse({...request,employeeId:""}).success,false);
});
test("tablet requests cannot inject purchasing status, names, timestamps or manager fields",()=>{
  for(const extra of [{status:"Besteld"},{employeeName:"Age"},{created_at:"2020-01-01"},{manager_note:"Approved"}])assert.equal(orderRequestSchema.safeParse({...request,...extra}).success,false);
  assert.equal(orderUpdateSchema.safeParse({id:request.id,version:0,status:"Besteld",managerNote:"Levering vrijdag",supplier:"Leverancier",reference:"PO123"}).success,true);
  assert.equal(orderUpdateSchema.safeParse({id:request.id,version:-1,status:"Besteld",managerNote:"",supplier:"",reference:""}).success,false);
});
test("purchase dashboard excludes goods already ordered or finished",()=>{
  assert.equal(orderNeedsPurchase("Nieuw"),true);
  assert.equal(orderNeedsPurchase("In behandeling"),true);
  assert.equal(orderNeedsPurchase("Besteld"),false);
  assert.equal(orderIsOpen("Besteld"),true);
  assert.equal(orderIsOpen("Ontvangen"),false);
  assert.equal(orderIsOpen("Afgewezen"),false);
});
