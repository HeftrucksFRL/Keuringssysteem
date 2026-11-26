export function agendaExportRequest(method:string,path:string){
  return method === "GET" && path === "/api/planning/mijnagenda";
}
