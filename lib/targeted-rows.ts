/** Fetch only requested records, keeping URL sizes and database concurrency bounded. */
export async function fetchTargetedRows<T>(ids:string[],fetchBatch:(ids:string[])=>PromiseLike<{data:T[]|null;error:{message:string}|null}>):Promise<T[]>{
  const unique=[...new Set(ids)],batches:string[][]=[];
  for(let from=0;from<unique.length;from+=100)batches.push(unique.slice(from,from+100));
  const pages:T[][]=new Array(batches.length);let cursor=0;
  async function worker(){
    while(cursor<batches.length){const index=cursor++;const {data,error}=await fetchBatch(batches[index]);if(error)throw new Error(`Gegevens ophalen mislukt: ${error.message}`);pages[index]=data??[];}
  }
  await Promise.all(Array.from({length:Math.min(4,batches.length)},worker));
  return pages.flat();
}
