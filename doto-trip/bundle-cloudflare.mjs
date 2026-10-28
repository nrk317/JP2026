// REST deployment fallback: package this small site's assets into its Worker.
// Normal Wrangler deployment uses the ASSETS binding in wrangler.jsonc.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const files=['index.html','app.js','style.css','favicon.svg'];
const assets={};for(const f of files)assets['/'+f]=await readFile(new URL('public/'+f,root),'utf8');
const binaryAssets={};for(let i=1;i<=9;i++){const file='tax-refund/'+String(i).padStart(2,'0')+'.webp';binaryAssets['/'+file]=(await readFile(new URL('public/'+file,root))).toString('base64')}
let source=(await readFile(new URL('worker.mjs',root),'utf8')).replace('export default {','const app = {');
source+='\nconst embeddedAssets='+JSON.stringify(assets)+';\n';
source+='\nconst binaryAssets='+JSON.stringify(binaryAssets)+';\n';
source+=`const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const serveAssets=async request=>{let path=new URL(request.url).pathname;if(path==='/')path='/index.html';if(binaryAssets[path]!==undefined){const data=Uint8Array.from(atob(binaryAssets[path]),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:data,{headers:{'Content-Type':'image/webp','Cache-Control':'no-cache'}})}const content=embeddedAssets[path];if(content===undefined)return new Response('Not found',{status:404});const ext=path.slice(path.lastIndexOf('.'));return new Response(request.method==='HEAD'?null:content,{headers:{'Content-Type':mime[ext],'Cache-Control':'no-cache'}})};
export default {fetch(request,env){return app.fetch(request,{...env,ASSETS:{fetch:serveAssets}})}};
`;
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/worker.mjs',root),source);
console.log('Cloudflare module packaged from current source');
