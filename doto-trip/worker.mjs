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
export default {
 async fetch(request,env){
  const url=new URL(request.url);
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
