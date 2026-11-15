const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let handler,stored;const id='11111111-1111-4111-8111-111111111111';
const communication=[{type:'outgoing',provider_id:'sent'},{type:'incoming',provider_id:'a'},{direction:'in',provider_id:'b'},{type:'incoming',provider_id:'arrived-later'}];
vm.runInNewContext(fs.readFileSync('supabase/functions/opravao-admin/index.ts','utf8'),{Request,Response,URL,Set,Date,JSON,console,atob,Deno:{env:{get:()=> 'test'},serve:fn=>handler=fn},fetch:async(url,opts={})=>{
 if(url.endsWith('/auth/v1/user'))return Response.json({email:'michalsurmanek@seznam.cz',email_confirmed_at:'yes'});
 if(url.includes('plotao_leads?'))return Response.json([{id,communication}]);
 if(opts.method==='POST'){stored=JSON.parse(opts.body);return Response.json([stored])}
 return Response.json([{value:{seen_ids:['a:1']}}]);
}});
(async()=>{
 const r=await handler(new Request('https://db.invalid',{method:'POST',headers:{origin:'https://opravao.cz',authorization:'Bearer test'},body:JSON.stringify({action:'mark_reply_read',id,seen_ids:['b:2','sent:0','fake']})}));
 assert.equal(r.status,200);assert.deepEqual(stored.value.seen_ids,['a:1','b:2']);assert.equal(stored.key,'inbox_read_'+id);assert.ok(!stored.value.seen_ids.includes('arrived-later:3'));
 const nodes=new Map();function $(q){if(!nodes.has(q))nodes.set(q,{hidden:q==='#replyModal',textContent:'',innerHTML:'',classList:{toggle(){}},setAttribute(){},contains(){return false},focus(){}});return nodes.get(q)}
 const settings={};let leads=[{id,name:'Client <one>',communication}],session={user:{id:'admin'}};const listeners={};let sentIds;
 const context=vm.createContext({$,settings,leads,session,Set,Date,window:{},archivedLeadIds:()=>[],esc:s=>String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'),when:s=>s||'time',document:{addEventListener:(type,fn)=>listeners[type]=fn},pollUnreadLeads(){},go(){},api:async(_,b)=>{sentIds=b.seen_ids;return {key:'inbox_read_'+id,value:{seen_ids:b.seen_ids}}}});
 vm.runInContext(fs.readFileSync('assets/opravao-admin-inbox.js','utf8'),context);
 assert.equal($('#inboxCount').textContent,'3');assert.match($('#inboxList').innerHTML,/Client &lt;one&gt;/);assert.match($('#inboxList').innerHTML,/data-reply-lead/);
 $('#replyModal').hidden=false;
 await listeners.click({target:{closest:()=>({dataset:{replyLead:id},classList:{contains:()=>true}})}});
 assert.equal(sentIds.length,3);assert.equal($('#inboxCount').hidden,true);
 communication.push({type:'incoming',provider_id:'new'});context.window.opravaoInbox.update();assert.equal($('#inboxCount').textContent,'1');
 console.log('PASS: only incoming messages counted, direct thread link, escaped preview, persistent read payload, forged IDs excluded and newly arriving messages remain unread');
})().catch(e=>{console.error(e);process.exit(1)});
