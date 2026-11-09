import type { SupabaseClient } from '@supabase/supabase-js';
import { checkMediaFile, uploadCmsFile } from './cmsUpload';
import { type CsvRow, assignImportedSku, downloadCsvErrors, skuFromImageFilename, validateCatalogueCsv, MAX_CSV_BYTES } from './bulkCsv';

type JobKind='csv'|'images';
type ItemStatus='imported'|'skipped'|'failed'|'pending';
export interface ImportStatus {
  jobId:string;total:number;processed:number;imported:number;skipped:number;failed:number;
  failures:{rowNumber:number;sku:string;message:string}[];
}
interface Job {id:string;total_count:number;status:string;}
interface StoredRow {row_number:number;sku:string;status:ItemStatus;}

export async function sha256(value:BufferSource):Promise<string>{
  const digest=await crypto.subtle.digest('SHA-256',value);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
/**
 * Stable UUID for an import-job row, allowing safe reconciliation if the
 * product draft was created but its audit row was not committed.
 */
export async function stableImportId(jobId:string,rowNumber:number):Promise<string>{
  if(!/^[0-9a-f-]{36}$/i.test(jobId) || !Number.isInteger(rowNumber) || rowNumber<1)
    throw new Error('Invalid import job identity');
  const bytes=await sha256(new TextEncoder().encode('nomaan-import-row:'+jobId+':'+rowNumber));
  const chars=bytes.slice(0,32).split('');
  chars[12]='5';
  chars[16]=((parseInt(chars[16],16)&3)|8).toString(16);
  const id=chars.join('');
  return [id.slice(0,8),id.slice(8,12),id.slice(12,16),id.slice(16,20),id.slice(20,32)].join('-');
}
async function getJob(client:SupabaseClient,userId:string,key:string,kind:JobKind,filename:string,total:number):Promise<Job>{
  const old=await client.from('nb_import_jobs').select('id,total_count,status')
    .eq('import_key',key).eq('created_by',userId).maybeSingle();
  if(old.error)throw new Error(old.error.message);
  if(old.data){
    if(old.data.total_count!==total)throw new Error('Import fingerprint collision: row count differs');
    return old.data as Job;
  }
  const created=await client.from('nb_import_jobs').insert({
    import_key:key,kind,filename:filename.slice(0,240),status:'running',
    total_count:total,created_by:userId,
  }).select('id,total_count,status').single();
  if(created.error||!created.data)throw new Error(created.error?.message||'Import job could not be created');
  return created.data as Job;
}
async function existingRows(client:SupabaseClient,jobId:string,numbers:number[]):Promise<Map<number,StoredRow>>{
  if(!numbers.length)return new Map();
  const {data,error}=await client.from('nb_import_rows')
    .select('row_number,sku,status').eq('job_id',jobId).in('row_number',numbers);
  if(error)throw new Error(error.message);
  return new Map((data||[]).map(x=>[x.row_number,x as StoredRow]));
}
async function getCounters(client:SupabaseClient,jobId:string){
  const [ok,skip,fail]=await Promise.all(['imported','skipped','failed'].map(status=>
    client.from('nb_import_rows').select('row_number',{count:'exact',head:true})
      .eq('job_id',jobId).eq('status',status)));
  for(const result of [ok,skip,fail])if(result.error)throw new Error(result.error.message);
  return {imported:ok.count||0,skipped:skip.count||0,failed:fail.count||0};
}
async function saveCounters(client:SupabaseClient,jobId:string,total:number,counters:{imported:number;skipped:number;failed:number}){
  const processed=counters.imported+counters.skipped+counters.failed;
  const status=processed===total?(counters.failed?'completed_with_errors':'completed'):'running';
  const {error}=await client.from('nb_import_jobs').update({
    status,processed_count:processed,success_count:counters.imported,
    skipped_count:counters.skipped,error_count:counters.failed,
  }).eq('id',jobId);
  if(error)throw new Error('Unable to persist import counters: '+error.message);
}
function adjustCounts(c:{imported:number;skipped:number;failed:number},status:ItemStatus,delta:number){
  if(status==='imported')c.imported+=delta;
  if(status==='skipped')c.skipped+=delta;
  if(status==='failed')c.failed+=delta;
}
function snapshot(jobId:string,total:number,c:{imported:number;skipped:number;failed:number},
  failures:{rowNumber:number;sku:string;message:string}[]):ImportStatus{
  return {jobId,total,processed:c.imported+c.skipped+c.failed,...c,failures:[...failures]};
}

/** Inserts private product drafts only. Published content never changes. */
export async function importCatalogueFile(
  client:SupabaseClient,userId:string,file:File,
  progress:(status:ImportStatus)=>void,
):Promise<ImportStatus>{
  if(file.size>MAX_CSV_BYTES)throw new Error('Catalogue CSV exceeds 8 MB');
  const csv=await file.text();
  const rows=validateCatalogueCsv(csv);
  if(!rows.length)throw new Error('CSV has no catalogue records');
  const key=await sha256(new TextEncoder().encode('csv\n'+csv));
  const job=await getJob(client,userId,key,'csv',file.name,rows.length);
  const counters=await getCounters(client,job.id);
  const failures:ImportStatus['failures']=[];
  for(let i=0;i<rows.length;i+=50){
    const batch=rows.slice(i,i+50);
    const previous=await existingRows(client,job.id,batch.map(x=>x.rowNumber));
    const outstanding=batch.filter(row=>!['imported','skipped'].includes(previous.get(row.rowNumber)?.status||''));
    if(!outstanding.length){progress(snapshot(job.id,rows.length,counters,failures));continue;}

    // Reserve all blank-SKU rows in bounded server-side batches. Persist each
    // reservation first so a network failure or page refresh never changes
    // its identity on retry. Counter gaps are okay; duplicate SKUs are not.
    const reserved=new Map<number,string>();
    const toReserve=new Map<string,CsvRow[]>();
    for(const row of outstanding){
      if(row.error||row.sku)continue;
      const prior=previous.get(row.rowNumber)?.sku;
      if(prior && /^NB-[A-Z]{2,3}-[0-9]{5}$/.test(prior)){
        reserved.set(row.rowNumber,prior);
      }else{
        toReserve.set(row.categoryPath,[...(toReserve.get(row.categoryPath)||[]),row]);
      }
    }
    for(const [categoryPath,waiting] of toReserve){
      const {data,error}=await client.rpc('nb_reserve_skus',{
        p_category_path:categoryPath,p_count:waiting.length,
      });
      if(error||!Array.isArray(data)||data.length!==waiting.length)
        throw new Error('Unable to reserve unique product SKUs: '+(error?.message||'Unexpected response'));
      const reservations=waiting.map((row,index)=>{
        const sku=String(data[index]);
        reserved.set(row.rowNumber,sku);
        return {job_id:job.id,row_number:row.rowNumber,sku,
          status:'pending',message:'SKU reserved; product draft not yet imported'};
      });
      const {error:saveError}=await client.from('nb_import_rows')
        .upsert(reservations,{onConflict:'job_id,row_number'});
      if(saveError)throw new Error('Could not save reserved SKUs: '+saveError.message);
    }
    const todo=outstanding.map(row=>row.sku?row:
      row.error?row:assignImportedSku(row,reserved.get(row.rowNumber)||''));
    const valid=todo.filter(row=>!row.error);
    const found=new Set<string>();
    if(valid.length){
      const {data,error}=await client.from('nb_studio_product_index').select('sku').in('sku',valid.map(x=>x.sku));
      if(error)throw new Error('Could not check existing SKUs: '+error.message);
      for(const item of data||[])found.add(String(item.sku).toUpperCase());
    }
    const ids=new Map<number,string>();
    for(const row of valid)ids.set(row.rowNumber,await stableImportId(job.id,row.rowNumber));
    const existingIds=[...ids.values()];
    let previouslyInserted=new Set<string>();
    if(existingIds.length){
      const {data,error}=await client.from('nb_product_drafts')
        .select('product_id').in('product_id',existingIds);
      if(error)throw new Error('Cannot reconcile existing draft products: '+error.message);
      previouslyInserted=new Set((data||[]).map(x=>String(x.product_id)));
    }
    // A prior run may have committed the product before recording the job
    // result. Mark that exact deterministic record imported, not skipped.
    const newRows=valid.filter(row=>!found.has(row.sku) &&
      !previouslyInserted.has(ids.get(row.rowNumber)!));
    const drafts=newRows.map(row=>({
      product_id:ids.get(row.rowNumber)!,content:row.draft,updated_by:userId,
    }));
    let draftError:string|null=null;
    if(drafts.length){
      const {error}=await client.from('nb_product_drafts').insert(drafts);
      if(error)draftError=error.message;
    }
    const updates=todo.map(row=>{
      let status:ItemStatus='imported',message='';
      if(row.error){status='failed';message=row.error;}
      else if(previouslyInserted.has(ids.get(row.rowNumber)!)){
        status='imported';message='Recovered draft created by an interrupted import';
      }
      else if(found.has(row.sku)){status='skipped';message='Existing SKU; no overwrite';}
      else if(draftError){status='failed';message='Draft batch failed: '+draftError;}
      if(status==='failed')failures.push({rowNumber:row.rowNumber,sku:row.sku,message});
      const prior=previous.get(row.rowNumber);
      if(prior)adjustCounts(counters,prior.status,-1);
      adjustCounts(counters,status,1);
      return {job_id:job.id,row_number:row.rowNumber,sku:row.sku||'INVALID-'+row.rowNumber,
        status,message,product_id:status==='imported'?ids.get(row.rowNumber):null};
    });
    const saved=await client.from('nb_import_rows').upsert(updates,{onConflict:'job_id,row_number'});
    if(saved.error)throw new Error('Import audit could not be saved: '+saved.error.message);
    await saveCounters(client,job.id,rows.length,counters);
    progress(snapshot(job.id,rows.length,counters,failures));
  }
  return snapshot(job.id,rows.length,counters,failures);
}

/** Bounded resumable image uploads; owner approval remains a separate step. */
export async function importImageFiles(
  client:SupabaseClient,userId:string,files:File[],
  progress:(status:ImportStatus,currentFilename:string,percent:number)=>void,
  options?:{department:'men'|'kids';categoryPath:string},
):Promise<ImportStatus>{
  if(!files.length||files.length>250)throw new Error('Choose 1–250 photos in a batch');
  // Hash the actual file bytes (one file at a time) for deterministic retries.
  const fingerprints:string[]=[];
  for(const file of files)fingerprints.push(file.name+':'+await sha256(await file.arrayBuffer()));
  const key=await sha256(new TextEncoder().encode('images\n'+(options?.categoryPath||'')+'\n'+fingerprints.join('\n')));
  const job=await getJob(client,userId,key,'images',files.length+' product photos',files.length);
  const counters=await getCounters(client,job.id);
  const failures:ImportStatus['failures']=[];
  const previous=await existingRows(client,job.id,files.map((_f,i)=>i+1));
  for(let i=0;i<files.length;i++){
    const file=files[i],index=i+1,prior=previous.get(index);
    if(prior && (prior.status==='imported'||prior.status==='skipped')){
      progress(snapshot(job.id,files.length,counters,failures),file.name,100);
      continue;
    }
    const match=skuFromImageFilename(file.name);
    const validation=checkMediaFile(file) || (!match?'Use SKU_01.jpg image naming':'');
    let status:ItemStatus='imported',message='',mediaId:string|null=null;
    if(validation){status='failed';message=validation;}
    else{
      try{
        const deterministicId=await stableImportId(job.id,index);
        const asset=await uploadCmsFile(client,file,userId,percent=>
          progress(snapshot(job.id,files.length,counters,failures),file.name,percent),
          {stableObjectId:deterministicId,department:options?.department,categoryPath:options?.categoryPath});
        mediaId=asset.id;
      }catch(error){status='failed';message=error instanceof Error?error.message:'Upload failed';}
    }
    if(status==='failed')failures.push({rowNumber:index,sku:match?.sku||'UNKNOWN',message});
    if(prior)adjustCounts(counters,prior.status,-1);
    adjustCounts(counters,status,1);
    const {error}=await client.from('nb_import_rows').upsert({
      job_id:job.id,row_number:index,sku:match?.sku||'INVALID-'+index,
      status,message,media_id:mediaId,
    },{onConflict:'job_id,row_number'});
    if(error)throw new Error('Image import audit failed: '+error.message);
    await saveCounters(client,job.id,files.length,counters);
    progress(snapshot(job.id,files.length,counters,failures),file.name,100);
  }
  return snapshot(job.id,files.length,counters,failures);
}

export function csvFailureReport(status:ImportStatus):string {
  return downloadCsvErrors(status.failures);
}
