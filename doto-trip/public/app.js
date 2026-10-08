'use strict';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=new URLSearchParams(location.hash.slice(1)).get('key')||'';
let state=null,revision=0,tab='days',dayId='',busy=false,dirty=false,editing=false;
const tabs=[['days','◷','每日行程'],['bookings','▣','交通住宿'],['places','◇','餐廳景點'],['lists','☑','旅行清單'],['expenses','¥','記帳預算'],['safety','❄','天氣與道路'],['contacts','☎','重要資訊']];
const cats=['餐飲','住宿','交通','票券','購物','其他'];
const fields={
 settings:[['title','旅行名稱','text',true],['start','出發日期','date'],['end','回程日期','date'],['members','旅伴姓名（以逗號分隔）'],['budget','總預算（JPY）','number'],['rate','1 JPY 換算 TWD（自行更新匯率）','number'],['notes','旅行共用備註','textarea']],
 days:[['title','當日主題','text',true],['date','日期','date'],['region','地區／目的地'],['planA','方案 A','textarea'],['planB','方案 B／天候備案','textarea'],['weather','天氣紀錄／確認時間'],['road','道路紀錄／確認時間'],['notes','當日備註','textarea']],
 events:[['time','開始時間（日本時間）','time'],['title','活動名稱','text',true],['type','類型','select',['景點','餐廳','交通','住宿','其他']],['plan','所屬方案','select',['共用','A','B']],['location','地點／地址（供地圖查詢）'],['duration','停留建議（分鐘）','number'],['drive','行車預估（分鐘，自行確認）','number'],['highlight','亮點','textarea'],['notes','備註／預訂需求','textarea']],
 bookings:[['type','預訂類型','select',['航班','租車','住宿','票券']],['name','名稱','text',true],['date','日期','date'],['time','時間（日本時間）','time'],['end','結束／退房日期','date'],['from','出發／取車地點'],['to','抵達／還車／住宿地址'],['code','航班號／訂房代碼'],['status','狀態','select',['待訂','已訂','待確認','已取消']],['contact','業者聯絡方式'],['url','票券／訂單連結','url'],['notes','車型、雪胎、條款／入住備註','textarea']],
 places:[['type','類型','select',['餐廳','景點']],['name','名稱','text',true],['choice','主選／備案','select',['主選','備案']],['region','地區'],['location','地址'],['hours','營業時間／公休日（待確認）'],['duration','停留建議（分鐘）','number'],['highlight','必吃／景點亮點','textarea'],['url','官方網站／地圖連結','url'],['notes','預約、停車、冬季開放資訊','textarea']],
 shopping:[['name','購買品項','text',true],['owner','負責人'],['qty','數量','number'],['estimate','預估金額（JPY）','number'],['notes','購買地點／備註','textarea']],
 packing:[['name','行李品項','text',true],['owner','攜帶人'],['qty','數量','number'],['notes','備註','textarea']],
 tasks:[['name','待辦事項','text',true],['owner','負責人'],['date','期限','date'],['notes','備註','textarea']],
 expenses:[['name','支出項目','text',true],['date','日期','date'],['category','分類','select',cats],['currency','幣別','select',['JPY','TWD']],['amount','金額','number',true],['payer','付款人','text',true],['split','分攤旅伴（以逗號分隔；空白代表全體）'],['notes','付款方式／備註','textarea']],
 contacts:[['type','資訊類型','select',['旅伴','緊急聯絡','保險','業者','其他']],['name','名稱','text',true],['phone','電話（含國碼）'],['url','相關連結','url'],['notes','保單、訂單／其他備註','textarea']]
};
const uid=()=>crypto.randomUUID();
const money=v=>Math.round(Number(v)||0).toLocaleString('zh-TW');
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',3200)}
function btn(label,action,cls=''){return `<button class="${cls}" data-act="${action}">${esc(label)}</button>`}
function empty(title,text,action,label='新增'){return `<div class="empty"><div class="symbol">❄</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${btn(label,action,'primary')}</div>`}
function safeUrl(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
function link(v,label){const url=safeUrl(v);return url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:''}
function kv(obj,items){return `<dl class="kv">${items.filter(([k])=>obj[k]!==''&&obj[k]!=null).map(([k,l])=>`<dt>${esc(l)}</dt><dd>${esc(obj[k])}</dd>`).join('')}</dl>`}
function actions(coll,id){return `<div class="small-actions">${btn('編輯',`edit:${coll}:${id}`)}${btn('刪除',`delete:${coll}:${id}`)}</div>`}
function sortDaysByDate(days){days.sort((a,b)=>(a.date||'9999-12-31').localeCompare(b.date||'9999-12-31'))}
function moveEventBetweenDays(days,sourceId,eventId,targetId){
 const source=days.find(d=>d.id===sourceId),target=days.find(d=>d.id===targetId);
 const index=source?.events.findIndex(e=>e.id===eventId)??-1;
 if(!source||!target||source===target||index<0)throw new Error('請選擇有效的目標日期');
 const [event]=source.events.splice(index,1);target.events.push(event);return target;
}
function regionTag(region){const name=String(region||'').trim();const regions=[...new Set(state.places.map(p=>String(p.region||'').trim()).filter(Boolean))].sort();return `<span class="tag ${name?'region-'+(regions.indexOf(name)%10):''}">${esc(name||'地區待填')}</span>`}
function transferEditor(sourceId,eventId){
 const options=state.days.filter(d=>d.id!==sourceId);
 if(!options.length){toast('請先新增另一個旅行日期');return}
 editing=true;$('#editorTitle').textContent='移動活動到其他天';
 $('#fields').innerHTML=`<label>移到哪一天？<select name="day">${options.map(d=>`<option value="${esc(d.id)}">${esc(d.date||'日期待定')} · ${esc(d.title)}</option>`).join('')}</select></label><p class="sub">活動會加入目標日期的最後，保留時間、亮點與全部備註；可再用上移／下移調整。</p>`;
 $('#formError').textContent='';$('#editor').showModal();
 $('#form').onsubmit=async e=>{e.preventDefault();if(busy)return;try{const target=moveEventBetweenDays(state.days,sourceId,eventId,new FormData(e.target).get('day'));dayId=target.id;closeEditor();dirty=true;render();await save()}catch(error){$('#formError').textContent=error.message}};
}
function mapLink(location){return location?link('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(location),'查看地圖'):''}
function header(title,sub,action,label){return `<div class="section-head"><div><h2>${title}</h2><p class="sub">${sub}</p></div>${action?btn(label||'新增',action,'primary'):''}</div>`}
function render(){if(!state)return;
 $('#tripTitle').textContent=state.settings.title;document.title=state.settings.title+' · 旅行手帳';
 $('#tripMeta').textContent=`${state.settings.start||'出發日期待定'}${state.settings.end?' — '+state.settings.end:''} · ${state.settings.members||'旅伴待填入'}`;
 $('#nav').innerHTML=tabs.map(([id,icon,name])=>`<button data-act="tab:${id}" class="${tab===id?'active':''}" ${tab===id?'aria-current="page"':''}><span>${icon}</span>${name}</button>`).join('');
 const total=state.expenses.reduce((a,e)=>a+jpy(e),0);
 let html='';
 if(tab==='days'){
 html=`<div class="stats"><div class="stat"><span>旅行天數</span><b>${state.days.length||'—'}</b></div><div class="stat"><span>已排活動</span><b>${state.days.reduce((a,d)=>a+d.events.length,0)}</b></div><div class="stat"><span>預訂待確認</span><b>${state.bookings.filter(b=>b.status==='待訂'||b.status==='待確認').length}</b></div></div>`+header('每日行程','依自己的步調，安排每一天。','add:days','新增一天');
 if(!state.days.length)html+=empty('第一天，從這裡開始','先新增日期與當日主題，再加入景點、餐廳和交通。所有內容都可隨時調整。','add:days','新增第一天');
 else{const d=state.days.find(x=>x.id===dayId)||state.days[0];dayId=d.id;const idx=state.days.indexOf(d);
 html+=`<div class="day-tabs">${state.days.map((x,i)=>`<button data-act="day:${x.id}" class="${x.id===d.id?'active':''}">DAY ${String(i+1).padStart(2,'0')} · ${esc(x.date||'日期待定')}</button>`).join('')}</div><div class="split"><div><div class="day-header"><div class="row wrap"><div><span class="tag">DAY ${idx+1}</span><h2>${esc(d.title)}</h2><div class="sub">${esc(d.region||'地區待填入')} · ${esc(d.date||'日期待定')}</div></div>${actions('days',d.id)}</div><div class="small-actions" style="margin-top:12px">${btn('前移一天',`move:days:${d.id}:-1`)}${btn('後移一天',`move:days:${d.id}:1`)}</div></div>`+header('當日時間軸','可調整活動順序，也能移到其他天。',`add:events:${d.id}`,'新增活動');
 html+=d.events.length?`<div class="timeline">${d.events.map(e=>`<article class="panel event"><div class="row"><div><div class="time">${esc(e.time||'時間待定')} <span class="tag">${esc(e.type)}</span><span class="tag">${e.plan==='共用'?'A / B 共用':'方案 '+esc(e.plan)}</span></div><h3>${esc(e.title)}</h3></div><div class="small-actions">${btn('上移',`move:events:${e.id}:-1`)}${btn('下移',`move:events:${e.id}:1`)}</div></div>${kv(e,[['location','地點'],['duration','停留（分）'],['drive','行車（分）'],['highlight','亮點']])}<p class="note">${esc(e.notes)}</p><div class="row wrap">${mapLink(e.location)}${btn('移至其他天',`transfer:${d.id}:${e.id}`)}${actions('events',e.id)}</div></article>`).join('')}</div>`:empty('當天行程還是空白','新增活動後，可填時間、亮點、停留建議與方案 A / B。',`add:events:${d.id}`,'新增活動');
 const stops=d.events.filter(e=>e.location&&e.plan!=='B').map(e=>e.location);
 const route=stops.length>=2?'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(stops[0])+'&destination='+encodeURIComponent(stops.at(-1))+'&waypoints='+encodeURIComponent(stops.slice(1,-1).join('|'))+'&travelmode=driving':'';
 html+=`</div><div><div class="panel"><h3>地圖與路線</h3>${stops.length?`<iframe title="當日第一站地圖" loading="lazy" referrerpolicy="no-referrer" src="https://maps.google.com/maps?q=${encodeURIComponent(stops[0])}&output=embed"></iframe><div class="link-row">${mapLink(stops[0])}${link(route,'開啟方案 A 行車路線')}</div><p class="sub">${stops.length} 個地點 · 依時間軸順序；方案 B 活動另行查看地圖。</p>`:'<div class="map-box">加入活動地址後顯示地圖</div>'}<p class="sub">路線依 Google Maps 顯示；冬季行車時間與封路另行確認。</p></div><div class="panel"><h3>方案 A / B</h3><span class="tag">A · 主要安排</span><p class="note">${esc(d.planA||'主要安排待填入')}</p><span class="tag">B · 天候備案</span><p class="note">${esc(d.planB||'天候不佳時的替代安排待填入')}</p>${btn('調整方案',`edit:days:${d.id}`)}</div><div class="panel"><h3>當日備註</h3><p class="note">${esc(d.notes||'沒有備註')}</p>${btn('編輯備註',`edit:days:${d.id}`)}</div></div></div>`;
 }
 }else if(tab==='bookings'){
 html=header('交通、住宿與票券','將確認資訊集中，出發前一眼查閱。','add:bookings','新增預訂');
 html+=state.bookings.length?`<div class="grid">${state.bookings.map(b=>`<article class="panel"><span class="tag booking-${({住宿:'stay',租車:'car',航班:'flight',票券:'ticket'})[b.type]||'other'}">${esc(b.type)}</span><span class="tag">${esc(b.status)}</span><h3 style="margin-top:12px">${esc(b.name)}</h3>${kv(b,[['date','日期'],['time','時間'],['end','結束日期'],['from','出發／取車'],['to','抵達／地址'],['code','預訂代碼'],['contact','聯絡方式']])}<p class="note">${esc(b.notes)}</p><div class="link-row">${link(b.url,'開啟票券／訂單')}${mapLink(b.to)}</div>${actions('bookings',b.id)}</article>`).join('')}</div>`:empty('預訂資訊待填入','航班、取還車、住宿與票券都可分別新增；訂單可以使用連結保存。','add:bookings','新增預訂');
 }else if(tab==='places'){
 html=header('餐廳與景點口袋名單','保留主選和備案，旅途中彈性切換。','add:places','新增地點');
 html+=state.places.length?`<div class="grid">${state.places.map(p=>`<article class="panel"><span class="tag">${esc(p.type)}</span><span class="tag">${esc(p.choice)}</span>${regionTag(p.region)}<h3 style="margin-top:12px">${esc(p.name)}</h3>${kv(p,[['location','地址'],['hours','營業資訊'],['duration','停留（分）'],['highlight','亮點']])}<p class="note">${esc(p.notes)}</p><div class="link-row">${mapLink(p.location)}${link(p.url,'相關網站')}</div><div class="row wrap">${btn('加入每日行程',`schedule:${p.id}`)}${actions('places',p.id)}</div></article>`).join('')}</div>`:empty('收集想去的地方','填入餐廳主選、備案、景點亮點和停留建議，再加入每日行程。','add:places','新增餐廳／景點');
 }else if(tab==='lists'){
 html=header('旅行清單','勾選完成項目，分配旅伴各自負責的事情。');
 html+=`<div class="grid">${[['shopping','購買清單'],['packing','行李清單'],['tasks','待辦事項']].map(([c,title])=>`<section class="panel"><div class="row"><h3>${title}</h3>${btn('新增',`add:${c}`)}</div><div class="sub">${state[c].filter(x=>x.done).length} / ${state[c].length} 完成</div>${state[c].length?state[c].map(x=>`<div class="list-item"><input type="checkbox" aria-label="完成 ${esc(x.name)}" data-check="${c}:${x.id}" ${x.done?'checked':''}><label class="${x.done?'done':''}">${esc(x.name)}<span class="sub">${esc([x.owner,x.date,x.qty?'× '+x.qty:'',x.estimate?'¥ '+money(x.estimate):''].filter(Boolean).join(' · '))}</span><span class="sub">${esc(x.notes)}</span></label>${actions(c,x.id)}</div>`).join(''):'<p class="note">尚未新增項目</p>'}</section>`).join('')}</div>`;
 }else if(tab==='expenses'){
 const budget=Number(state.settings.budget)||0,rate=Number(state.settings.rate)||0;
 html=header('共同記帳與預算','統一換算為日幣；匯率由旅行設定自行維護。','add:expenses','記一筆');
 html+=`<div class="stats"><div class="stat"><span>實際支出 JPY</span><b>¥ ${money(total)}</b></div><div class="stat"><span>總預算 JPY</span><b>${budget?'¥ '+money(budget):'待設定'}</b></div><div class="stat"><span>剩餘預算 JPY</span><b class="${budget&&total>budget?'danger':''}">${budget?'¥ '+money(budget-total):'—'}</b></div></div><div class="split"><div><div class="panel"><div class="row"><h3>支出分類</h3>${btn('調整預算／匯率','settings')}</div>${cats.map(c=>{const n=state.expenses.filter(e=>e.category===c).reduce((a,e)=>a+jpy(e),0);return `<div class="category-row"><span>${c}</span><div class="bar"><div style="width:${total?n/total*100:0}%"></div></div><span class="amount">¥ ${money(n)}</span></div>`}).join('')}<p class="sub">約 NT$ ${money(total*rate)} · 1 JPY = ${esc(rate)} TWD（手動匯率）</p></div>`;
 html+=state.expenses.length?state.expenses.map(e=>`<article class="panel"><div class="row"><div><span class="tag">${esc(e.category)}</span><h3>${esc(e.name)}</h3><p class="sub">${esc(e.date||'日期待填')} · ${esc(e.payer)} 付款</p></div><b class="amount">${esc(e.currency)} ${money(e.amount)}</b></div><p class="note">分攤：${esc(e.split||state.settings.members||'旅伴尚未設定')}<br>${esc(e.notes)}</p>${actions('expenses',e.id)}</article>`).join(''):empty('還沒有支出紀錄','記錄金額、付款人和分攤旅伴，分類統計會自動更新。','add:expenses','新增第一筆支出');
 html+=`</div><div><div class="panel"><h3>旅伴分攤概覽</h3><p class="sub">每筆均分至指定旅伴；空白使用全體名單。正值表示應收，負值表示應付。</p>${balances()}<p class="sub">尚未納入轉帳／還款紀錄；此處為支出分攤參考。</p></div><div class="panel"><h3>購買清單預估</h3><b>¥ ${money(state.shopping.reduce((a,x)=>a+(Number(x.estimate)||0),0))}</b><p class="sub">每項預估填總價；只有實際新增支出才計入預算。</p></div></div></div>`;
 }else if(tab==='safety'){
 html=header('天氣、道路與冬季駕駛','依每日確認結果記錄；這裡不會自動取得即時路況。');
 html+=`<div class="panel"><h3>出發前確認</h3><div class="link-row">${link('https://www.jma.go.jp/bosai/','日本氣象廳')}${link('https://www.road-info-prvs.mlit.go.jp/roadinfo/','北海道道路資訊')}${link('https://www.jartic.or.jp/','JARTIC 交通資訊')}</div><div class="help">天氣、道路、能見度或交通狀況不適合時，使用方案 B 並重新確認交通安排。</div><h3>冬季自駕確認欄位</h3><ul class="plain"><li>與租車業者確認雪胎、車輛配備與緊急聯絡方式。</li><li>記錄道路開放狀態、天氣查詢時間和備用路線。</li><li>預留行車與休息時間，依當日狀況調整行程。</li></ul></div>`;
 html+=state.days.length?`<div class="grid">${state.days.map(d=>`<div class="panel"><h3>${esc(d.date||'日期待定')} · ${esc(d.title)}</h3>${kv(d,[['weather','天氣／確認'],['road','道路／確認'],['planB','方案 B']])}${btn('更新紀錄',`edit:days:${d.id}`)}</div>`).join('')}</div>`:empty('新增旅行日期後，逐日記錄','每一天都保留天氣、道路確認時間與方案 B 欄位。','add:days','新增一天');
 }else if(tab==='contacts'){
 html=header('重要聯絡與旅行備註','集中旅伴、保險、業者聯絡方式。','add:contacts','新增資訊');
 html+=`<div class="panel"><div class="row"><h3>旅行共用備註</h3>${btn('編輯','settings')}</div><p class="note">${esc(state.settings.notes||'旅行共用備註待填入')}</p><div class="small-actions">${btn('旅行設定','settings')}${btn('下載資料備份','export')}</div></div>`;
 html+=state.contacts.length?`<div class="grid">${state.contacts.map(c=>`<article class="panel"><span class="tag">${esc(c.type)}</span><h3 style="margin-top:12px">${esc(c.name)}</h3>${kv(c,[['phone','電話'],['notes','備註']])}<div class="link-row">${link(c.url,'相關資料')}</div>${actions('contacts',c.id)}</article>`).join('')}</div>`:empty('重要資訊待填入','新增保險與業者聯絡資訊，方便旅途中快速找到。','add:contacts','新增聯絡資訊');
 }
 $('#content').innerHTML=html;
}
function jpy(e){const rate=Number(state.settings.rate)||0;return e.currency==='TWD'?(rate?Number(e.amount)/rate:0):Number(e.amount)||0}
function names(s){return [...new Set(String(s||'').split(/[,，、\n]/).map(x=>x.trim()).filter(Boolean))]}
function balances(){const all=names(state.settings.members),bal={},unallocated=[];for(const e of state.expenses){const list=names(e.split).length?names(e.split):all;if(!list.length){unallocated.push(e);continue}const n=jpy(e);bal[e.payer]=(bal[e.payer]||0)+n;for(const p of list)bal[p]=(bal[p]||0)-n/list.length}return Object.entries(bal).map(([name,n])=>`<div class="row list-item"><span>${esc(name)}</span><b class="amount">${n>=0?'應收':'應付'} ¥ ${money(Math.abs(n))}</b></div>`).join('')+(unallocated.length?`<p class="help">${unallocated.length} 筆尚未設定分攤旅伴，暫不計入分攤。</p>`:'')||'<p class="note">新增支出與旅伴後顯示。</p>'}
function collection(c){return c==='events'?state.days.find(d=>d.id===dayId).events:state[c]}
function openEditor(c,id,parent){editing=true;const old=c==='settings'?state.settings:id?collection(c).find(x=>x.id===id):{};const item={...old};$('#editorTitle').textContent=(c==='settings'?'旅行設定':id?'編輯':'新增')+(c==='settings'?'':{days:'旅行日期',events:'行程活動',bookings:'預訂',places:'地點',shopping:'購買品項',packing:'行李',tasks:'待辦',expenses:'支出',contacts:'重要資訊'}[c]);
 $('#fields').innerHTML=fields[c].map(([k,l,t='text',req])=>{const v=item[k]??(c==='settings'&&k==='rate'?0.22:'');return `<label>${esc(l)}${req===true?' *':''}${t==='select'?`<select name="${k}">${req.map(x=>`<option ${v===x?'selected':''}>${esc(x)}</option>`).join('')}</select>`:t==='textarea'?`<textarea name="${k}">${esc(v)}</textarea>`:`<input name="${k}" type="${t}" value="${esc(v)}" ${req===true?'required':''} ${t==='number'?`min="${k==='rate'?'0.000001':'0'}" step="any"`:''}>`}</label>`}).join('');
 $('#formError').textContent='';$('#editor').showModal();
 $('#form').onsubmit=async event=>{event.preventDefault();if(busy)return;const fd=new FormData(event.target);const data={...item};for(const [k,,t] of fields[c])data[k]=t==='number'?Number(fd.get(k)||0):String(fd.get(k)||'').trim();
 if(fields[c].some(([k,,,required])=>required===true&&!data[k]&&k!=='amount')){$('#formError').textContent='請填入必要欄位。';return}
 if(c==='settings'&&data.end&&data.start&&data.end<data.start){$('#formError').textContent='回程日期需晚於或等於出發日期。';return}
 if(c==='expenses'&&data.amount<=0){$('#formError').textContent='金額需大於零。';return}
 if(c==='settings'&&data.rate<=0){$('#formError').textContent='匯率需大於零。';return}
 if(c==='settings')state.settings=data;else if(id)Object.assign(collection(c).find(x=>x.id===id),data);else{data.id=uid();if(c==='days'){data.events=[];dayId=data.id}if(['shopping','packing','tasks'].includes(c))data.done=false;(c==='events'?state.days.find(d=>d.id===parent||d.id===dayId).events:state[c]).push(data)}
 if(c==='days')sortDaysByDate(state.days);closeEditor();dirty=true;render();await save();};
}
function closeEditor(){$('#editor').close();editing=false}
async function api(method='GET',value){const res=await fetch('/api/trip',{method,headers:{'X-Trip-Key':key,'Content-Type':'application/json'},body:value?JSON.stringify(value):undefined});const data=await res.json();if(!res.ok){const err=new Error(data.error||'連線失敗');err.status=res.status;throw err}return data}
function banner(message){$('#banner').hidden=false;$('#banner').innerHTML=`${esc(message)}<div>${btn('下載目前草稿','export')}${btn('重試儲存','retry')}${btn('載入最新版本','reload')}</div>`}
async function save(){if(busy)return;busy=true;$('#sync').textContent='儲存中…';try{const result=await api('PUT',{revision,state});revision=result.revision;dirty=false;$('#banner').hidden=true;$('#sync').textContent='已同步';toast('已儲存，旅伴可查看更新')}catch(e){$('#sync').textContent='尚未儲存';banner(e.message)}finally{busy=false}}
async function load(initial=false){try{const result=await api();if(initial||(!dirty&&!editing&&!busy&&result.revision!==revision)){state=result.state;revision=result.revision;dirty=false;$('#banner').hidden=true;render()}if(!dirty)$('#sync').textContent='已同步'}catch(e){$('#sync').textContent='連線失敗';if(initial){$('#content').innerHTML=`<div class="empty"><h3>尚未連上旅行資料</h3><p>${esc(e.message)}</p><p>請由啟動程式提供的完整連結開啟，再重新整理。</p>${btn('重新連線','connect')}</div>`}else if(!dirty)$('#sync').textContent='暫時離線'}}
function download(){if(!state)return;const url=URL.createObjectURL(new Blob([JSON.stringify({format:'doto-trip-v1',revision,state},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='道東旅行備份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
async function act(action){const [op,c,id,delta]=action.split(':');if(op==='tab'){tab=c;render();return}if(op==='connect'){await load(true);return}if(!state)return;
 if(op==='settings'){openEditor('settings');return}if(op==='export'){download();return}if(op==='retry'){await save();return}if(op==='reload'){if(dirty&&!confirm('載入最新版本會放棄畫面上未儲存的修改。請先下載草稿。繼續？'))return;await load(true);return}
 if(op==='day'){dayId=c;render();return}if(busy){toast('請等目前儲存完成再修改');return}
 if(op==='transfer'){transferEditor(c,id);return}
 if(op==='add'){openEditor(c,null,id);return}if(op==='edit'){openEditor(c,id);return}
 if(op==='delete'){if(!confirm(c==='days'?'刪除這一天及全部當日活動？':'刪除這個項目？'))return;const arr=collection(c);arr.splice(arr.findIndex(x=>x.id===id),1)}
 if(op==='move'){const arr=collection(c),idx=arr.findIndex(x=>x.id===id),next=idx+Number(delta);if(next<0||next>=arr.length)return;[arr[idx],arr[next]]=[arr[next],arr[idx]]}
 if(op==='schedule'){if(!state.days.length){toast('請先新增旅行日期');tab='days';render();return}const p=state.places.find(x=>x.id===c);editing=true;$('#editorTitle').textContent='加入每日行程';$('#fields').innerHTML=`<label>加入哪一天？<select name="day">${state.days.map(d=>`<option value="${d.id}">${esc(d.date||'日期待定')} · ${esc(d.title)}</option>`).join('')}</select></label>`;$('#formError').textContent='';$('#editor').showModal();$('#form').onsubmit=async e=>{e.preventDefault();if(busy)return;const d=state.days.find(d=>d.id===new FormData(e.target).get('day'));d.events.push({id:uid(),title:p.name,type:p.type,plan:p.choice==='備案'?'B':'A',location:p.location,duration:p.duration,highlight:p.highlight,notes:p.notes,time:'',drive:0});dayId=d.id;tab='days';closeEditor();dirty=true;render();await save()};return}
 dirty=true;render();await save();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b)act(b.dataset.act)});
document.addEventListener('change',async e=>{if(!e.target.dataset.check)return;if(busy){render();return}const [c,id]=e.target.dataset.check.split(':');state[c].find(x=>x.id===id).done=e.target.checked;dirty=true;render();await save()});
$('#close').onclick=$('#cancel').onclick=closeEditor;$('#editor').addEventListener('cancel',()=>editing=false);
$('#settings').onclick=()=>act('settings');$('#export').onclick=download;
$('#share').onclick=async()=>{if(!key){toast('請先由完整的旅行連結開啟');return}const url=location.origin+'/#key='+encodeURIComponent(key);try{await navigator.clipboard.writeText(url);toast('已複製分享連結；持有連結的人可查看與編輯')}catch{prompt('複製分享連結；持有連結的人可查看與編輯',url)}};
window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue=''}});
load(true);setInterval(()=>{if(!dirty&&!editing&&!busy)load()},10000);
