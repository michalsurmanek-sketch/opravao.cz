const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('supabase/functions/opravao-push/index.ts','utf8');
let handler,admin=true,deliveryStatus=0,deliveries=[],removed=[],rows=[];
const cfg={id:1,dispatch_secret:'internal-test-token',public_key:'public-test-key',private_key:'private-test-key'};
const webpush={sendNotification:async(sub,payload)=>{deliveries.push(JSON.parse(payload));if(deliveryStatus)throw {statusCode:deliveryStatus};}};
const context={exports:{},require:()=>({default:webpush}),Response,URL,console:{error(){}},Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://example.supabase.co':'server-key'},serve:fn=>handler=fn},fetch:async(url,opts)=>{
 if(url.includes('/auth/v1/user'))return Response.json(admin?{email:'michalsurmanek@seznam.cz',email_confirmed_at:'2026-11-27'}:{email:'other@example.com',email_confirmed_at:'2026-11-27'});
 if(url.includes('opravao_push_config'))return Response.json([cfg]);
 if(url.includes('opravao_push_subscriptions')){if(opts.method==='DELETE'){removed.push(url);return new Response(null,{status:204});}if(opts.method==='POST')return new Response(null,{status:201});return Response.json(rows);}
 if(url.includes('plotao_leads'))return Response.json([{id:'00000000-0000-0000-0000-000000000001',source:'opravao.cz',payload:{registrationType:'company'}}]);
 throw Error('Unexpected fetch '+url);
}};
vm.runInNewContext(stripTypeScriptTypes(source).replace("import webpush from 'npm:web-push@3.6.7';","const webpush=require('web-push').default;"),context);
const request=(body,token='admin',origin='https://opravao.cz')=>handler(new Request('https://example.supabase.co/functions/v1/opravao-push',{method:body?'POST':'GET',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));
(async()=>{
 assert.equal((await request(null,'admin','https://evil.example')).status,403);
 admin=false;assert.equal((await request(null)).status,403);admin=true;
 let r=await request(null);assert.deepEqual(await r.json(),{publicKey:'public-test-key'});
 assert.equal((await request({action:'subscribe',subscription:{endpoint:'https://127.0.0.1/private'}})).status,422);
 const sub={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}};
 assert.equal((await request({action:'subscribe',subscription:sub})).status,200);
 assert.equal((await request({action:'dispatch',table:'plotao_leads',id:'00000000-0000-0000-0000-000000000001'})).status,400);
 rows=[{endpoint:sub.endpoint,subscription:sub}];
 assert.equal((await(await request({action:'test',endpoint:sub.endpoint})).json()).sent,1);
 assert.equal((await(await request({action:'dispatch',table:'plotao_leads',id:'00000000-0000-0000-0000-000000000001'},cfg.dispatch_secret,'')).json()).sent,1);
 assert.match(deliveries.at(-1).title,/registrace/);assert.match(deliveries.at(-1).url,/push_id=/);
 deliveryStatus=410;assert.equal((await(await request({action:'test',endpoint:sub.endpoint})).json()).failed,1);assert.equal(removed.length,1);
 let handlers={},shown,opened;
 const worker={self:{location:{origin:'https://opravao.cz'},addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(title,data)=>shown={title,...data}}},URL,clients:{matchAll:async()=>[],openWindow:async url=>opened=url}};
 vm.runInNewContext(fs.readFileSync('opravao-push-sw.js','utf8'),worker);
 let pending;handlers.push({data:{json:()=>deliveries[1]},waitUntil:p=>pending=p});await pending;assert.match(shown.title,/registrace/);
 handlers.notificationclick({notification:{close(){},data:shown.data},waitUntil:p=>pending=p});await pending;assert.match(opened,/https:\/\/opravao.cz\/admin.html\?push_kind=lead/);
 opened=null;handlers.notificationclick({notification:{close(){},data:{url:'https://evil.example/'}},waitUntil:p=>pending=p});assert.equal(opened,null);
 console.log('PASS: admin authorization, subscription validation, delivery, expired subscriptions, notification links');
})().catch(e=>{console.error(e);process.exitCode=1});
