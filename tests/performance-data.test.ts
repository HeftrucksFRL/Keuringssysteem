import {test} from "node:test";
import assert from "node:assert/strict";
import {fetchTargetedRows} from "../lib/targeted-rows";
import {isPublicAssetPath} from "../lib/public-assets";

test("large targeted selections remain complete, deduplicate IDs and bound simultaneous queries",async()=>{
 const ids=Array.from({length:2501},(_,i)=>String(i)),calls:string[][]=[];
 let active=0,maxActive=0;
 const result=await fetchTargetedRows([...ids,...ids.slice(0,100)],async batch=>{
   calls.push(batch);active++;maxActive=Math.max(maxActive,active);
   await new Promise(resolve=>setTimeout(resolve,1));active--;
   return {data:batch.map(id=>({id})),error:null};
 });
 assert.equal(result.length,2501);assert.deepEqual(result.map(row=>row.id),ids);
 assert.equal(calls.length,26);assert.ok(calls.every(batch=>batch.length<=100));
 assert.ok(maxActive>1&&maxActive<=4);
});
test("targeted selections skip empty queries and never return partial results on an error",async()=>{
 assert.deepEqual(await fetchTargetedRows([],()=>{throw new Error("should not query");}),[]);
 await assert.rejects(()=>fetchTargetedRows(["a","b"],async()=>({data:null,error:{message:"offline"}})),/offline/);
});
test("only explicit public assets skip session checks; pages and API paths stay protected",()=>{
 for(const path of ["/manifest.webmanifest","/app-icon-192.png","/werkplaats-preview/assets/planning.js"])assert.equal(isPublicAssetPath(path),true);
 for(const path of ["/planning","/api/files","/api/files/private.png","/klanten/export.jpg","/werkplaats-preview/index.html","/api/planning/cursussen","/frello"])assert.equal(isPublicAssetPath(path),false);
});

import {unwrapLazyModule} from "../lib/lazy-module";
test("lazy operations remain callable from both production and maintenance-script namespaces",async()=>{
 const [documents,mail,photos]=await Promise.all([import("../lib/documents"),import("../lib/mailer"),import("../lib/attachments")]);
 assert.equal(typeof unwrapLazyModule(documents).generateInspectionDocuments,"function");
 assert.equal(typeof unwrapLazyModule(mail).sendInspectionEmails,"function");
 assert.equal(typeof unwrapLazyModule(photos).storeInspectionPhotos,"function");
});
