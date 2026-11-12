import {test} from "node:test";
import assert from "node:assert/strict";
import {isWorkshopViewer,workshopViewerRequestAllowed,resolveLoginIdentifier,canManageWorkshopTablet} from "../lib/workshop-access";

test("only server-assigned metadata defines tablet access",()=>{
  assert.equal(isWorkshopViewer({app_metadata:{app_role:"workshop_viewer"}}),true);
  assert.equal(isWorkshopViewer({app_metadata:{role:"workshop_viewer"}}),false);
  assert.equal(isWorkshopViewer(null),false);
  assert.equal(isWorkshopViewer({email:"info@heftrucks.frl"}),false);
  const selfAssigned={id:"test",user_metadata:{app_role:"workshop_viewer"}};
  assert.equal(isWorkshopViewer(selfAssigned),false);
});
test("tablet is read-only and cannot invoke server actions through allowed pages",()=>{
  for(const p of ["/werkplaats","/api/werkplaats","/werkplaats-preview/index.html","/werkplaats-preview/assets/planning.js"]){
    assert.equal(workshopViewerRequestAllowed(p,"GET"),true);
    assert.equal(workshopViewerRequestAllowed(p,"POST"),false);
    assert.equal(workshopViewerRequestAllowed(p,"PUT"),false);
  }
  for(const p of ["/klanten","/planning","/api/inspections","/api/files","/werkplaats/tablet","/api/werkplaats/tablet-account"])
    assert.equal(workshopViewerRequestAllowed(p,"GET"),false);
  assert.equal(workshopViewerRequestAllowed("/api/werkplaats/session","DELETE"),true);
  assert.equal(workshopViewerRequestAllowed("/api/werkplaats/session","POST"),false);
});
test("workshop uses a username without a mailbox; existing accounts keep their login",()=>{
  assert.equal(resolveLoginIdentifier(" Werkplaats "),"werkplaats@accounts.invalid");
  assert.equal(resolveLoginIdentifier("info@heftrucks.frl"),"info@heftrucks.frl");
  assert.equal(canManageWorkshopTablet({email:"info@heftrucks.frl"}),true);
  assert.equal(canManageWorkshopTablet({email:"info@terpstratrading.frl"}),true);
  assert.equal(canManageWorkshopTablet({email:"werkplaats@accounts.invalid",app_metadata:{app_role:"workshop_viewer"}}),false);
  assert.equal(canManageWorkshopTablet({email:"other@example.com"}),false);
});
