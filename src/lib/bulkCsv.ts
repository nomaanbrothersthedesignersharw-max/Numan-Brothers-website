import { COLLECTION_ROUTES } from '../storefront/navigation';

export const MAX_CSV_BYTES = 8 * 1024 * 1024;
export const MAX_IMPORT_RECORDS = 10000;
export interface CsvRow {
  rowNumber: number;
  sku: string;
  title: string;
  department: 'men'|'kids';
  categoryPath: string;
  draft: {
    sku:string;slug:string;title:string;department:'men'|'kids';categoryPaths:string[];
    description:string;fabric:string;sizes:string[];imageUrls:string[];videoUrl:string;
    price:string;sortRank:number;
  };
  error: string|null;
}
const headerNames=['sku','title','department','category','sizes','fabric','description','price'];
const categoryPaths=new Map(COLLECTION_ROUTES.map(c=>[c.path,c.department]));

export function parseCsv(text:string):string[][] {
  const source=text.replace(/^\uFEFF/,'');
  const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(quoted){
      if(char==='"' && source[i+1]==='"'){cell+='"';i++;}
      else if(char==='"')quoted=false;
      else cell+=char;
    }else if(char==='"'){
      if(cell.trim())throw new Error('Quote found in the middle of a CSV field');
      quoted=true;
    }else if(char===','){row.push(cell);cell='';}
    else if(char==='\n'||char==='\r'){
      if(char==='\r'&&source[i+1]==='\n')i++;
      row.push(cell);cell='';
      if(row.some(x=>x.trim()))rows.push(row);
      row=[];
      if(rows.length>MAX_IMPORT_RECORDS+1)throw new Error('Import limit is 10,000 rows per CSV');
    }else cell+=char;
  }
  if(quoted)throw new Error('Unclosed quoted CSV field');
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
export function validateCatalogueCsv(csv:string):CsvRow[]{
  if(new TextEncoder().encode(csv).byteLength>MAX_CSV_BYTES)
    throw new Error('CSV must not exceed 8 MB');
  const rows=parseCsv(csv);
  if(!rows.length)throw new Error('CSV contains no header');
  const fields=rows[0].map(x=>x.trim().toLowerCase());
  for(const required of ['title','department','category']){
    if(!fields.includes(required))throw new Error('Missing CSV column: '+required);
  }
  if(new Set(fields).size!==fields.length)throw new Error('Duplicate header names');
  if(rows.length-1>MAX_IMPORT_RECORDS)throw new Error('Maximum 10,000 products per CSV');
  const seen=new Set<string>();
  return rows.slice(1).map((columns,index)=>{
    const source=Object.fromEntries(fields.map((key,i)=>[key,(columns[i]||'').trim()]));
    const sku=String(source.sku||'').toUpperCase();
    const title=String(source.title||'');
    const dep=source.department==='kids'?'kids':'men';
    const category=String(source.category||'');
    const sizes=String(source.sizes||'').split('|').map(x=>x.trim()).filter(Boolean).slice(0,40);
    const price=String(source.price||'');
    let error:string|null=null;
    if(sku && !/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(sku))error='SKU must be 2–80 letters, digits, underscore or hyphen';
    else if(sku && seen.has(sku))error='Duplicate SKU in CSV';
    else if(title.length<2||title.length>180)error='Title must be 2–180 characters';
    else if(source.department!=='men'&&source.department!=='kids')error='Department must be men or kids';
    else if(categoryPaths.get(category)!==dep)error='Invalid category or category department mismatch';
    else if(price && (!/^\d{1,10}(?:\.\d{1,2})?$/.test(price)||Number(price)<0))
      error='Invalid optional price';
    else if(columns.length>fields.length)error='Extra CSV columns found';
    if(sku)seen.add(sku);
    const slugBase=title.toLowerCase().normalize('NFKD')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'garment';
    const slug=sku ? slugBase+'-'+sku.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') : slugBase;
    const draft:CsvRow['draft']={
      sku,slug,title,department:dep,categoryPaths:category?[category]:[],
      description:String(source.description||'').slice(0,2000),fabric:String(source.fabric||'').slice(0,250),
      sizes,imageUrls:[] as string[],videoUrl:'',price,sortRank:0,
    };
    return {rowNumber:index+2,sku,title,department:dep,categoryPath:category,draft,error};
  });
}
export function skuFromImageFilename(name:string):{sku:string;order:number}|null{
  const match=/^([a-zA-Z0-9][a-zA-Z0-9_-]{1,79})_(\d{2,4})\.(jpg|jpeg|png|webp|avif|gif)$/i.exec(name);
  if(!match)return null;
  const order=Number(match[2]);if(order<1||order>9999)return null;
  return {sku:match[1].toUpperCase(),order};
}
export function downloadCsvErrors(rows:{rowNumber:number;sku:string;message:string}[]):string{
  // Quoting alone does not prevent CSV formula injection in spreadsheet apps.
  const esc=(value:string|number)=>{
    const text=String(value);
    const safe=/^[\\t\\r\\n ]*[=+@-]/.test(text)?"'"+text:text;
    return '"'+safe.replace(/"/g,'""')+'"';
  };
  return ['row,sku,error',...rows.map(x=>[x.rowNumber,x.sku,x.message].map(esc).join(','))].join('\r\n');
}

// A SKU is optional in product CSV. The authenticated import job reserves one
// from the server for each row and persists it in nb_import_rows before writing
// the draft so interrupted imports can safely resume with the same identity.
export function assignImportedSku(row:CsvRow,sku:string):CsvRow {
  const code=sku.trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(code))
    throw new Error('The database returned an invalid garment SKU');
  const suffix=code.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return {...row,sku:code,draft:{...row.draft,sku:code,slug:row.draft.slug+'-'+suffix}};
}

/**
 * The owner can select ordinary camera photos and assign a single product SKU
 * to the batch. The resulting names follow SKU_01.jpg, SKU_02.jpg, so they can
 * be matched automatically after approval, without guessing image contents.
 * Pre-named multi-product batches remain supported when no SKU is specified.
 */
export function prepareSkuPhotoBatch(files:File[],rawSku:string):File[] {
  const sku=rawSku.trim().toUpperCase();
  if(!sku)return files;
  if(!/^NB-[A-Z]{2,3}-[0-9]{5}$/.test(sku))
    throw new Error('Enter a generated SKU such as NB-SH-00001, or leave blank for pre-named batches.');
  if(files.length>250)throw new Error('Choose no more than 250 photos');
  const byMime:Record<string,string>={
    'image/jpeg':'jpg','image/png':'png','image/webp':'webp',
    'image/avif':'avif','image/gif':'gif',
  };
  return files.map((file,index)=>{
    const ext=byMime[file.type];
    if(!ext)throw new Error('Only JPG, PNG, WebP, AVIF or GIF photos can be imported');
    return new File([file],sku+'_'+String(index+1).padStart(2,'0')+'.'+ext,{
      type:file.type,lastModified:file.lastModified,
    });
  });
}
