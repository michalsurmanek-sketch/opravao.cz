import webpush from 'npm:web-push@3.6.7';
const base=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins=new Set(['https://opravao.cz','https://www.opravao.cz']);
const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
async function db(path:string,options:RequestInit={}){const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{...headers,...options.headers}});if(!r.ok)throw Error('database_error');const text=await r.text();return text?JSON.parse(text):null;}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'null','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'}});
 if(req.method==='OPTIONS')return respond({ok:true});
 if(!['GET','POST'].includes(req.method))return respond({error:'method_not_allowed'},405);
 try{
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const cfg=(await db('opravao_push_config?id=eq.1&select=*'))[0];
 if(!cfg)return respond({error:'not_configured'},503);
 const internal=token===cfg.dispatch_secret;
 if(!internal){
  if(!origins.has(origin))return respond({error:'origin_not_allowed'},403);
  const r=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token}});
  const user=r.ok?await r.json():null;
  if(!user?.email_confirmed_at||user.email?.toLowerCase()!=='michalsurmanek@seznam.cz')return respond({error:'admin_forbidden'},403);
 }
 if(!cfg.public_key){
  const vapid=webpush.generateVAPIDKeys();
  await db('opravao_push_config?id=eq.1&public_key=is.null',{method:'PATCH',body:JSON.stringify({public_key:vapid.publicKey,private_key:vapid.privateKey})});
  Object.assign(cfg,(await db('opravao_push_config?id=eq.1&select=*'))[0]);
 }
 if(req.method==='GET'){if(internal)return respond({error:'forbidden'},403);return respond({publicKey:cfg.public_key});}
 const b=await req.json();
 if(internal&&b.action!=='dispatch')return respond({error:'forbidden'},403);
 if(b.action==='subscribe'||b.action==='unsubscribe'){
  if(internal)return respond({error:'forbidden'},403);
  const sub=b.subscription;
  let endpoint:URL;try{endpoint=new URL(sub?.endpoint)}catch{return respond({error:'invalid_subscription'},422)}
  // Only known browser push providers; never fetch an arbitrary client-supplied URL.
  if(endpoint.protocol!=='https:'||endpoint.port||endpoint.username||endpoint.password||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(endpoint.hostname))return respond({error:'unsupported_push_provider'},422);
  if(b.action==='unsubscribe'){await db('opravao_push_subscriptions?endpoint=eq.'+encodeURIComponent(sub.endpoint),{method:'DELETE'});return respond({ok:true});}
  if(!/^[A-Za-z0-9_-]{87}$/.test(sub.keys?.p256dh||'')||!/^[A-Za-z0-9_-]{22}$/.test(sub.keys?.auth||''))return respond({error:'invalid_keys'},422);
  await db('opravao_push_subscriptions?on_conflict=endpoint',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({endpoint:sub.endpoint,subscription:sub,updated_at:new Date().toISOString()})});
  return respond({ok:true});
 }
 let payload,subs;
 if(b.action==='test'&&!internal){
  if(typeof b.endpoint!=='string')return respond({error:'invalid_endpoint'},422);
  subs=await db('opravao_push_subscriptions?endpoint=eq.'+encodeURIComponent(b.endpoint)+'&select=*');
  payload={title:'Opravao.cz – zkušební oznámení',body:'Upozornění na poptávky a registrace jsou zapnutá.',url:'/admin.html',tag:'opravao-test'};
 }else if(b.action==='dispatch'&&internal){
  if(!['plotao_leads','opravao_partners'].includes(b.table)||!/^[-a-f0-9]{36}$/i.test(b.id||''))return respond({error:'invalid_event'},422);
  const row=(await db(b.table+'?id=eq.'+b.id+'&select=*'))[0];
  if(!row||b.table==='plotao_leads'&&row.source!=='opravao.cz')return respond({skipped:true});
  const company=b.table==='opravao_partners'||row.payload?.registrationType==='company';
  payload={title:company?'Opravao.cz – nová registrace řemeslníka':'Opravao.cz – nová poptávka',body:'Klepnutím otevřete záznam v administraci.',url:'/admin.html?push_kind='+(b.table==='plotao_leads'?'lead':'partner')+'&push_id='+row.id,tag:'opravao-'+row.id};
  subs=await db('opravao_push_subscriptions?select=*');
 }else return respond({error:'unknown_action'},400);
 const results=await Promise.all(subs.map(async (s:any)=>{
  try{await webpush.sendNotification(s.subscription,JSON.stringify(payload),{vapidDetails:{subject:'mailto:info@opravao.cz',publicKey:cfg.public_key,privateKey:cfg.private_key},TTL:86400,timeout:10000});return true;}
  catch(e){if([404,410].includes(e.statusCode))await db('opravao_push_subscriptions?endpoint=eq.'+encodeURIComponent(s.endpoint),{method:'DELETE'});console.error('Push delivery status',e.statusCode||'network_error');return false;}
 }));
 return respond({sent:results.filter(Boolean).length,failed:results.filter(x=>!x).length});
 }catch(e){console.error('Push operation failed',e.message);return respond({error:'push_failed'},500);}
});
