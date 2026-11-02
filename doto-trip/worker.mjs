const initial = {settings:{title:'道東冬日自駕',start:'',end:'',members:'',budget:0,rate:0.22,notes:''},days:[],bookings:[],places:[],shopping:[],packing:[],tasks:[],expenses:[],contacts:[]};
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
async function authorized(key,expected){
 if(!expected||!key)return false;
 const digest=async x=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)));
 const a=await digest(key),b=await digest(expected);let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}
function valid(state){
 if(!state||typeof state!=='object'||Array.isArray(state)||Object.keys(state).sort().join()!==Object.keys(initial).sort().join())return false;
 if(!state.settings||typeof state.settings!=='object'||Array.isArray(state.settings))return false;
 if(!Number.isFinite(state.settings.rate)||state.settings.rate<=0||!Number.isFinite(state.settings.budget)||state.settings.budget<0)return false;
 for(const k of Object.keys(initial).filter(k=>k!=='settings')){
  if(!Array.isArray(state[k])||state[k].length>10000)return false;
  if(state[k].some(x=>!x||typeof x!=='object'||Array.isArray(x)||typeof x.id!=='string'))return false;
 }
 if(state.days.some(d=>!Array.isArray(d.events)||d.events.some(e=>!e||typeof e.id!=='string')))return false;
 return !state.expenses.some(e=>!Number.isFinite(e.amount)||e.amount<=0||!['JPY','TWD'].includes(e.currency));
}
async function imagePayload(request){
 const reader=request.body?.getReader();if(!reader)throw new Error('缺少圖片資料');
 let size=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>410000){await reader.cancel();throw new Error('圖片過大，請重新選取')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder().decode(bytes));
}
async function imageApi(request,env,url){
 if(!env.DB||!env.TRIP_ACCESS_KEY)return json(503,{error:'圖片服務尚未設定完成。'});
 if(!await authorized(request.headers.get('X-Trip-Key'),env.TRIP_ACCESS_KEY))return json(401,{error:'請由完整旅行連結開啟。'});
 if(!['GET','POST','DELETE'].includes(request.method))return json(405,{error:'不支援此操作。'});
 if(request.method!=='GET'&&request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json(403,{error:'不允許跨網站寫入。'});
 const owner=url.searchParams.get('owner')||'';
 if(!/^(events|places|bookings):[a-zA-Z0-9_-]{1,100}$/.test(owner))return json(400,{error:'行程項目不正確。'});
 try{
  if(request.method==='GET'){
   const result=await env.DB.prepare('SELECT id,name,data,created_at FROM trip_images WHERE owner=? AND deleted_at IS NULL ORDER BY created_at,id').bind(owner).all();return json(200,{images:result.results});
  }
  if(request.method==='DELETE'){
   const id=url.searchParams.get('id')||'';if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return json(400,{error:'圖片項目不正確。'});
   await env.DB.prepare("UPDATE trip_images SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND owner=? AND deleted_at IS NULL").bind(id,owner).run();return json(200,{ok:true});
  }
  let payload;try{payload=await imagePayload(request)}catch{return json(400,{error:'圖片格式不正確或超過大小限制。'})}
  if(typeof payload.name!=='string'||!payload.name.trim()||payload.name.length>160||typeof payload.data!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(payload.data))return json(400,{error:'僅支援經壓縮的 JPEG 圖片。'});
  let raw;try{raw=atob(payload.data.slice(23))}catch{return json(400,{error:'圖片內容不正確。'})}
  if(raw.length>300000||raw.length<4||raw.charCodeAt(0)!==255||raw.charCodeAt(1)!==216||raw.charCodeAt(2)!==255||raw.charCodeAt(raw.length-2)!==255||raw.charCodeAt(raw.length-1)!==217)return json(400,{error:'圖片內容不正確或超過大小限制。'});
  const row=await env.DB.prepare('SELECT body FROM workspace WHERE id=1').first();const trip=row?JSON.parse(row.body):null;
  const [kind,itemId]=owner.split(':');const items=kind==='events'?trip?.days.flatMap(d=>d.events):trip?.[kind];
  if(!items?.some(item=>item.id===itemId))return json(404,{error:'這個行程項目已不存在，請重新整理。'});
  const id=crypto.randomUUID();const saved=await env.DB.prepare('INSERT INTO trip_images(id,owner,name,data) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM trip_images WHERE owner=? AND deleted_at IS NULL)<6 RETURNING id').bind(id,owner,payload.name.trim(),payload.data,owner).first();
  if(!saved)return json(409,{error:'每個項目最多 6 張圖片，請先移除不需要的圖片。'});
  return json(201,{id});
 }catch(error){console.error('Image storage unavailable',error?.message);return json(503,{error:'圖片暫時無法讀寫，請稍後重試。'})}
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/images')return imageApi(request,env,url);
  if(url.pathname!=='/api/trip'){
   if(!['GET','HEAD'].includes(request.method))return json(405,{error:'不支援此操作。'});
   const response=await env.ASSETS.fetch(request);
   const result=new Response(response.body,response);result.headers.set('Referrer-Policy','no-referrer');result.headers.set('X-Content-Type-Options','nosniff');return result;
  }
  if(!env.DB||!env.TRIP_ACCESS_KEY)return json(503,{error:'旅行資料服務尚未設定完成。'});
  if(!await authorized(request.headers.get('X-Trip-Key'),env.TRIP_ACCESS_KEY))return json(401,{error:'請使用完整的旅行分享連結開啟。'});
  if(!['GET','PUT'].includes(request.method))return json(405,{error:'不支援此操作。'});
  if(request.method==='PUT'&&request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json(403,{error:'不允許跨網站寫入。'});
  try{
   if(request.method==='GET'){
    const row=await env.DB.prepare('SELECT revision, body FROM workspace WHERE id=1').first();
    if(!row)return json(503,{error:'旅行資料庫尚未初始化。'});
    return json(200,{revision:row.revision,state:JSON.parse(row.body)});
   }
   if(Number(request.headers.get('Content-Length'))>2_000_000)return json(413,{error:'資料過大，請縮短備註。'});
   // Bound streamed bodies too, even when no Content-Length was supplied.
   const reader=request.body?.getReader();if(!reader)return json(400,{error:'缺少資料。'});
   let length=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>2_000_000){await reader.cancel();return json(413,{error:'資料過大，請縮短備註。'})}chunks.push(value)}
   const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
   let payload;try{payload=JSON.parse(new TextDecoder().decode(bytes))}catch{return json(400,{error:'資料格式不正確。'})}
   if(!valid(payload.state)||!Number.isSafeInteger(payload.revision)||payload.revision<0)return json(400,{error:'資料格式不正確。'});
   const row=await env.DB.prepare('UPDATE workspace SET body=?, revision=revision+1 WHERE id=1 AND revision=? RETURNING revision').bind(JSON.stringify(payload.state),payload.revision).first();
   if(!row)return json(409,{error:'旅伴已更新資料。請先下載你的草稿，再載入最新版本。'});
   return json(200,{revision:row.revision});
  }catch(error){console.error('Trip storage unavailable',error?.message);return json(503,{error:'暫時無法儲存；你的修改仍保留在畫面，請重試。'})}
 }
};
export {initial};
