const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let forwarded=0,posted=[],events=[];const ctx={waitUntil:p=>events.push(p)};
const context=vm.createContext({Response,AbortSignal,Uint8Array,String,btoa,JSON,console:{warn(){},error(){},log(){}},fetch:async(url,opts)=>{posted.push(JSON.parse(opts.body));return Response.json({ok:true,stored:true})}});
vm.runInContext(fs.readFileSync('cloudflare/opravao-inbound-email-worker.js','utf8').replace('export default','globalThis.worker='),context);
function message(size=3_000_000,auth='mx.cloudflare.net; dkim=pass; dmarc=pass'){
 let accessed=false;
 return {headers:new Headers({'Authentication-Results':auth}),rawSize:size,get raw(){accessed=true;return new Blob(['real reply']).stream()},async forward(){assert.equal(accessed,size<=12_000_000&&auth.startsWith('mx.cloudflare.net;'));forwarded++}};
}
(async()=>{
 await context.worker.email(message(),{OPRAVAO_INBOUND_TOKEN:'test'},ctx);await Promise.all(events);assert.equal(forwarded,1);assert.equal(posted.length,1);assert.equal(atob(posted[0].raw),'real reply');
 await context.worker.email(message(13_000_000),{OPRAVAO_INBOUND_TOKEN:'test'},ctx);assert.equal(forwarded,2);assert.equal(posted.length,1);
 await context.worker.email(message(100,'untrusted.example; dkim=pass'),{OPRAVAO_INBOUND_TOKEN:'test'},ctx);assert.equal(forwarded,3);assert.equal(posted.length,1);
 console.log('PASS: replies above old 2 MB cap, stream captured before forwarding, background mirror, oversized and untrusted messages still forwarded but not imported');
})().catch(e=>{console.error(e);process.exit(1)});
