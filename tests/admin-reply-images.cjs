const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let handler,sent=[],patches=[],history=[],failSend=false;
const source=fs.readFileSync('supabase/functions/opravao-admin/index.ts','utf8');
const id='11111111-1111-4111-8111-111111111111';
vm.runInNewContext(source,{Request,Response,URL,Set,Date,JSON,console,atob,AbortSignal,Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://test.invalid':'test'},serve:fn=>handler=fn},fetch:async(url,opts={})=>{
 if(url.endsWith('/auth/v1/user'))return Response.json({email:'michalsurmanek@seznam.cz',email_confirmed_at:'2026-01-01'});
 if(url.startsWith('https://api.resend.com/emails/'))return Response.json({message_id:'<outgoing@example.invalid>'});
 if(url==='https://api.resend.com/emails'){sent.push(JSON.parse(opts.body));return Response.json(failSend?{message:'failed'}:{id:'provider-id'},{status:failSend?400:200})}
 if(opts.method==='PATCH'){patches.push(JSON.parse(opts.body));return Response.json([])}
 if(opts.method==='POST')return Response.json([]);
 return Response.json([{id,email:'customer@example.invalid',communication:history,status:'new'}]);
}});
const attachment={filename:'kupon.png',content_type:'image/png',content:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='};
async function call(extra={}){return handler(new Request('https://test.invalid/functions/v1/opravao-admin',{method:'POST',headers:{origin:'https://opravao.cz',authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify({action:'send_reply',id,request_id:id,message:'Test <script>\nŘádek',...extra})}))}
(async()=>{
 assert.equal((await call()).status,200);assert.equal(sent[0].attachments,undefined);assert.equal(sent[0].text,'Test <script>\nŘádek');assert.equal(sent[0].subject,'Vaše poptávka – Opravao.cz');
 assert.equal((await call({attachments:[attachment]})).status,200);assert.equal(sent[1].attachments[0].content,attachment.content);assert.match(sent[1].html,/cid:opravao-reply-image/);assert.match(sent[1].html,/&lt;script&gt;/);assert.ok(!sent[1].html.includes('Dobrý den'));assert.ok(!sent[1].html.includes('Opravao.cz'));assert.equal(patches[1].communication[0].message_id,'<outgoing@example.invalid>');assert.equal(patches[1].communication[0].attachments[0].filename,'kupon.png');assert.equal(patches[1].communication[0].attachments[0].content,undefined);
 for(const attachments of [[attachment,attachment],[{...attachment,content_type:'image/jpeg'}],[{...attachment,content:'<svg/>'}],[{...attachment,content:'AAAA'.repeat(1800000)}],{}])assert.equal((await call({attachments})).status,422);
 assert.equal(sent.length,2);
 history=[{request_id:id}];assert.equal((await (await call({attachments:[attachment]})).json()).already_sent,true);assert.equal(sent.length,2);
 history=[];failSend=true;assert.equal((await call({attachments:[attachment]})).status,502);assert.equal(patches.length,2);
 const denied=await handler(new Request('https://test.invalid',{method:'POST',headers:{origin:'https://evil.invalid'},body:'{}'}));assert.equal(denied.status,403);
 console.log('PASS: text-only, inline PNG, escaped HTML, history metadata, malformed/oversized/type/count rejection, retry deduplication, provider failure and origin restriction');
})().catch(e=>{console.error(e);process.exit(1)});
