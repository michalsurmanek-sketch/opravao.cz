const ALLOWED_ORIGINS = new Set(["https://opravao.cz","https://www.opravao.cz"]);
const ADMIN_EMAIL = "michalsurmanek@seznam.cz";
const STATUSES = new Set(["new","review","waiting_customer","preparing_quote","quote_sent","waiting_decision","ordered","partner_assigned","completed","closed","contacted"]);
const TYPES = new Set(["qualified_lead","subscription","featured_listing","commission","adjustment"]);
const json = (body, status=200, origin="") => new Response(JSON.stringify(body), {status, headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"null","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS","Vary":"Origin"}});
const str=(v,n=500)=>typeof v==="string"?v.trim().slice(0,n):"";
const safeId=v=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);
const baseEnv=()=>Deno.env.get("SUPABASE_URL")||"";
const keyEnv=()=>Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
async function currentAdmin(req,base,key){
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return false;
 const r=await fetch(base+"/auth/v1/user",{headers:{apikey:key,Authorization:"Bearer "+token}});
 if(!r.ok)return false;
 const u=await r.json().catch(()=>null);
 return String(u?.email||"").toLowerCase()===ADMIN_EMAIL && !!u?.email_confirmed_at;
}
const apiHeaders=key=>({apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"});
async function rest(base,key,path,opts={}){
 const r=await fetch(base+"/rest/v1/"+path,{...opts,headers:{...apiHeaders(key),...(opts.headers||{})}});
 const t=await r.text(); let data=null; try{data=t?JSON.parse(t):null}catch{data=t}
 return {ok:r.ok,status:r.status,data};
}
function fail(r){return json({error:"database_error",status:r.status,detail:typeof r.data==="object"?(r.data?.message||r.data?.code||""):String(r.data||"")},r.status)}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS")return json({ok:true},200,origin);
 if(!ALLOWED_ORIGINS.has(origin))return json({error:"origin_not_allowed"},403,origin);
 if(!["GET","POST","PATCH"].includes(req.method))return json({error:"method_not_allowed"},405,origin);
 const base=baseEnv(),key=keyEnv(); if(!base||!key)return json({error:"server_config"},500,origin);
 if(!await currentAdmin(req,base,key))return json({error:"admin_forbidden"},403,origin);
 const actor=ADMIN_EMAIL;
 if(req.method==="GET"){
  const resource=new URL(req.url).searchParams.get("resource")||"dashboard";
  if(resource==="coupons"){
   const [campaigns,archived,dispatches]=await Promise.all([rest(base,key,"opravao_coupon_campaigns?archived_at=is.null&select=*&order=created_at.desc&limit=500"),rest(base,key,"opravao_coupon_campaigns?archived_at=not.is.null&select=*&order=archived_at.desc&limit=500"),rest(base,key,"opravao_coupon_dispatches?select=campaign_id,status&limit=5000")]);
   if(!campaigns.ok)return fail(campaigns);if(!archived.ok)return fail(archived);if(!dispatches.ok)return fail(dispatches);
   const counts={};for(const item of dispatches.data||[]){if(item.status==="sent")counts[item.campaign_id]=(counts[item.campaign_id]||0)+1}
   return json({data:campaigns.data||[],archived:archived.data||[],sent_counts:counts},200,origin)
  }
  if(resource==="leads"){
   const r=await rest(base,key,"plotao_leads?source=eq.opravao.cz&select=id,created_at,submitted_at,name,phone,email,place,region,note,payload,status,assigned_to,next_action,next_action_at,partner_name,outcome,communication,updated_at&order=created_at.desc&limit=1000");
   return r.ok?json({data:r.data},200,origin):fail(r);
  }
  if(resource==="partners"){
   const r=await rest(base,key,"opravao_partners?select=*&order=created_at.desc&limit=1000");
   return r.ok?json({data:r.data},200,origin):fail(r);
  }
  if(resource==="distribution"){
   const r=await rest(base,key,"opravao_lead_distribution?select=*,opravao_partners(id,company_name,email,phone),plotao_leads(id,name,place,region,payload,source)&plotao_leads.source=eq.opravao.cz&order=created_at.desc&limit=1000");
   return r.ok?json({data:r.data},200,origin):fail(r);
  }
  if(resource==="revenue"){
   const r=await rest(base,key,"opravao_revenue?select=*,opravao_partners(id,company_name),plotao_leads(id,name,place)&order=created_at.desc&limit=1000");
   return r.ok?json({data:r.data},200,origin):fail(r);
  }
  const [leads,partners,rev,settings]=await Promise.all([
   rest(base,key,"plotao_leads?source=eq.opravao.cz&select=*&order=created_at.desc&limit=1000"),
   rest(base,key,"opravao_partners?select=*&order=created_at.desc&limit=1000"),
   rest(base,key,"opravao_revenue?select=*,opravao_partners(id,company_name)&order=created_at.desc&limit=1000"),
   rest(base,key,"opravao_settings?select=key,value")
  ]);
  if([leads,partners,rev,settings].some(x=>!x.ok))return fail([leads,partners,rev,settings].find(x=>!x.ok));
  return json({leads:leads.data,partners:partners.data,revenue:rev.data,settings:settings.data},200,origin);
 }
 let b;try{b=await req.json()}catch{return json({error:"invalid_json"},400,origin)}
 const action=str(b?.action,80);
 if(action==="test_invoice_email"){
  const resendKey=Deno.env.get("RESEND_API_KEY");if(!resendKey)return json({error:"resend_not_configured"},503,origin);
  const recipient="info@montao.cz";
  const now=new Date().toISOString().slice(0,10);
  const content="TEST – NEJEDNÁ SE O DAŇOVÝ DOKLAD\n\nOpravao.cz – zkouška fakturačního procesu\nDatum: "+now+"\nVystavitel (test): Radek Šurmánek, IČO 21138885\nPříjemce testu: "+recipient+"\nPoložka: Test fakturace Opravao.cz\nČástka k úhradě: 0 Kč\n\nTento e-mail pouze ověřuje doručování. Nic neplaťte. Doklad není účetní ani daňový doklad.";
  const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+resendKey,"Content-Type":"application/json"},body:JSON.stringify({from:"Opravao.cz <info@opravao.cz>",to:[recipient],reply_to:"info@opravao.cz",subject:"[TEST] Opravao.cz – zkušební faktura (neplatný doklad)",text:content})});
  const data=await sent.json().catch(()=>({}));
  if(!sent.ok)return json({error:"email_send_failed",detail:data.message||"Odeslání selhalo"},502,origin);
  await audit(base,key,actor,action,"test_invoice",data.id||"",{recipient});
  return json({ok:true,recipient,provider_id:data.id||null},200,origin);
 }
 if(action==="create_coupon"){
  const c=b.coupon||{};
  const title=str(c.title,160),code=str(c.code,40).toUpperCase().replace(/[^A-Z0-9_-]/g,""),region=str(c.region,80),repair_type=str(c.repair_type,80),provider_name=str(c.provider_name,160),description=str(c.description,1000),discount_percent=Number(c.discount_percent);
  const regions=new Set(["Hlavní město Praha","Středočeský kraj","Jihočeský kraj","Plzeňský kraj","Karlovarský kraj","Ústecký kraj","Liberecký kraj","Královéhradecký kraj","Pardubický kraj","Kraj Vysočina","Jihomoravský kraj","Olomoucký kraj","Zlínský kraj","Moravskoslezský kraj"]);
  if(title.length<3||code.length<3||!regions.has(region)||!Number.isFinite(discount_percent)||discount_percent<=0||discount_percent>100)return json({error:"invalid_coupon"},422,origin);
  const today=new Date().toISOString().slice(0,10),valid_from=str(c.valid_from,10)||today,valid_until=str(c.valid_until,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(valid_from)||valid_until&&!/^\d{4}-\d{2}-\d{2}$/.test(valid_until)||valid_until&&valid_until<valid_from)return json({error:"invalid_dates"},422,origin);
  const row={title,code,region,repair_type,provider_name,description,discount_percent,valid_from,valid_until:valid_until||null,status:"draft",created_by:actor};
  const saved=await rest(base,key,"opravao_coupon_campaigns",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify(row)});
  if(!saved.ok)return fail(saved);await audit(base,key,actor,action,"coupon",saved.data?.[0]?.id||"",row);return json({data:saved.data?.[0]},201,origin)
 }
 if(action==="archive_coupon"||action==="restore_coupon"||action==="delete_coupon"){
  if(!safeId(b.id))return json({error:"invalid_id"},422,origin);
  const found=await rest(base,key,"opravao_coupon_campaigns?id=eq."+b.id+"&select=id,title,archived_at");
  if(!found.ok)return fail(found);const campaign=found.data?.[0];if(!campaign)return json({error:"coupon_not_found"},404,origin);
  if(action==="delete_coupon"){
   if(!campaign.archived_at)return json({error:"coupon_must_be_archived_first",detail:"Nejprve kupón přesuňte do koše."},409,origin);
   const history=await rest(base,key,"opravao_coupon_dispatches?campaign_id=eq."+b.id+"&select=id&limit=1");
   if(!history.ok)return fail(history);if(history.data?.length)return json({error:"coupon_has_history",detail:"Kupón má záznamy o rozesílce, proto jej lze pouze ponechat v koši."},409,origin);
   const gone=await rest(base,key,"opravao_coupon_campaigns?id=eq."+b.id,{method:"DELETE",headers:{"Prefer":"return=representation"}});
   if(!gone.ok)return fail(gone);await audit(base,key,actor,action,"coupon",b.id,{});return json({ok:true},200,origin)
  }
  const archived_at=action==="archive_coupon"?new Date().toISOString():null;
  const saved=await rest(base,key,"opravao_coupon_campaigns?id=eq."+b.id,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify({archived_at,updated_at:new Date().toISOString()})});
  if(!saved.ok)return fail(saved);await audit(base,key,actor,action,"coupon",b.id,{archived_at});return json({data:saved.data?.[0]},200,origin)
 }
 if(action==="preview_coupon"){
  if(!safeId(b.id))return json({error:"invalid_id"},422,origin);
  const found=await rest(base,key,"opravao_coupon_campaigns?id=eq."+b.id+"&select=*");
  if(!found.ok)return fail(found);const campaign=found.data?.[0];if(!campaign)return json({error:"coupon_not_found"},404,origin);if(campaign.archived_at)return json({error:"coupon_archived",detail:"Kupón je v koši a nelze jej odeslat."},409,origin);
  const [leadResult,dispatchResult]=await Promise.all([rest(base,key,"plotao_leads?source=eq.opravao.cz&select=id,email,region,payload&limit=5000"),rest(base,key,"opravao_coupon_dispatches?campaign_id=eq."+b.id+"&select=lead_id&limit=5000")]);
  if(!leadResult.ok)return fail(leadResult);if(!dispatchResult.ok)return fail(dispatchResult);
  const already=new Set((dispatchResult.data||[]).map(x=>x.lead_id));
  const count=(leadResult.data||[]).filter(x=>x.email&&x.payload?.marketingConsent===true&&String(x.payload?.marketingRegion||"").trim()===campaign.region&&(!campaign.repair_type||x.payload?.repairType===campaign.repair_type)&&!already.has(x.id)).length;
  return json({eligible:count,region:campaign.region,repair_type:campaign.repair_type},200,origin)
 }
 if(action==="send_coupon"){
  if(!safeId(b.id))return json({error:"invalid_id"},422,origin);
  const found=await rest(base,key,"opravao_coupon_campaigns?id=eq."+b.id+"&select=*");
  if(!found.ok)return fail(found);const campaign=found.data?.[0];if(!campaign)return json({error:"coupon_not_found"},404,origin);if(campaign.archived_at)return json({error:"coupon_archived",detail:"Kupón je v koši a nelze jej odeslat."},409,origin);
  const today=new Date().toISOString().slice(0,10);if(campaign.valid_from&&campaign.valid_from>today||campaign.valid_until&&campaign.valid_until<today)return json({error:"coupon_outside_validity"},409,origin);
  const resendKey=Deno.env.get("RESEND_API_KEY");if(!resendKey)return json({error:"resend_not_configured"},503,origin);
  const [leadResult,dispatchResult]=await Promise.all([rest(base,key,"plotao_leads?source=eq.opravao.cz&select=id,email,name,region,payload&limit=5000"),rest(base,key,"opravao_coupon_dispatches?campaign_id=eq."+b.id+"&select=lead_id,status&limit=5000")]);
  if(!leadResult.ok)return fail(leadResult);if(!dispatchResult.ok)return fail(dispatchResult);
  const already=new Set((dispatchResult.data||[]).map(x=>x.lead_id));
  const recipients=(leadResult.data||[]).filter(x=>x.email&&x.payload?.marketingConsent===true&&String(x.payload?.marketingRegion||"").trim()===campaign.region&&(!campaign.repair_type||x.payload?.repairType===campaign.repair_type)&&!already.has(x.id));
  let sentCount=0,failedCount=0;
  for(const lead of recipients){
   const message="Ahoj,\\n\\npro oblast "+campaign.region+" pro vás máme slevový kupón "+campaign.code+". Ušetříte "+Number(campaign.discount_percent)+" %"+(campaign.repair_type?" na službu: "+campaign.repair_type:" na vybranou opravu.")+(campaign.provider_name?" u poskytovatele "+campaign.provider_name:"")+"."+ (campaign.description?"\\n"+campaign.description:"")+(campaign.valid_until?"\\nKupón platí do "+campaign.valid_until+".":"")+"\\n\\nPokud už nechcete dostávat podobné nabídky, napište nám na info@opravao.cz s předmětem Odhlásit slevy.\\n\\nTým Opravao.cz";
   const escapeHtml=value=>String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
   const safeDescription=escapeHtml(campaign.description),safeRegion=escapeHtml(campaign.region),safeRepairType=escapeHtml(campaign.repair_type),safeProvider=escapeHtml(campaign.provider_name),safeCode=escapeHtml(campaign.code);
   const html="<div style="+JSON.stringify("font-family:Arial,sans-serif;color:#20211f;line-height:1.6;max-width:620px;margin:auto")+"><h2 style="+JSON.stringify("color:#e94e1b")+">Sleva pro váš kraj</h2><p>Ahoj,</p><p>Pro oblast <strong>"+campaign.region+"</strong> pro vás máme slevový kupón:</p><p style="+JSON.stringify("font-size:28px;font-weight:bold;letter-spacing:3px;background:#f7f2e8;padding:16px;text-align:center")+">"+campaign.code+"</p><p><strong>Ušetříte "+Number(campaign.discount_percent)+" %</strong>"+(campaign.repair_type?" na službu "+campaign.repair_type:" na vybranou opravu")+(campaign.provider_name?" u poskytovatele "+campaign.provider_name:"")+".</p>"+(safeDescription?"<p>"+safeDescription+"</p>":"")+(campaign.valid_until?"<p>Kupón platí do "+campaign.valid_until+".</p>":"")+"<p>Tým Opravao.cz</p><hr><p style="+JSON.stringify("font-size:12px;color:#777")+">Nabídku posíláme na základě vašeho souhlasu se zasíláním slev. Pro odhlášení napište na <a href="+JSON.stringify("mailto:info@opravao.cz?subject=Odhlasit%20slevy")+">info@opravao.cz</a>.</p></div>";
   let status="sent",providerId="",errorCode="";
   try{const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+resendKey,"Content-Type":"application/json","Idempotency-Key":"opravao-coupon-"+campaign.id+"-"+lead.id},body:JSON.stringify({from:"Opravao.cz <info@opravao.cz>",to:[lead.email],reply_to:"info@opravao.cz",subject:"Slevový kupón pro "+campaign.region+" – Opravao.cz",text:message,html})});const result=await response.json().catch(()=>({}));if(response.ok){providerId=result.id||"";sentCount++}else{status="failed";errorCode=String(result.name||"resend_rejected").slice(0,80);failedCount++}}catch{status="failed";errorCode="network_error";failedCount++}
   const saved=await rest(base,key,"opravao_coupon_dispatches",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({campaign_id:campaign.id,lead_id:lead.id,status,provider_id:providerId,error_code:errorCode})});if(!saved.ok)console.error("coupon dispatch logging failed",saved.status)
  }
  await rest(base,key,"opravao_coupon_campaigns?id=eq."+campaign.id,{method:"PATCH",body:JSON.stringify({status:"active",updated_at:new Date().toISOString()})});
  await audit(base,key,actor,action,"coupon",campaign.id,{sent:sentCount,failed:failedCount,eligible:recipients.length});return json({ok:true,sent:sentCount,failed:failedCount,eligible:recipients.length},200,origin)
 }
 if(action==="send_reply"){
  if(!safeId(b.id)||!safeId(b.request_id)||typeof b.message!=="string"||b.message.trim().length<2||b.message.length>10000)return json({error:"invalid_reply"},422,origin);
  const leadResult=await rest(base,key,"plotao_leads?id=eq."+b.id+"&source=eq.opravao.cz&select=id,name,email,communication,status");
  if(!leadResult.ok)return fail(leadResult);
  const lead=leadResult.data?.[0];if(!lead)return json({error:"lead_not_found"},404,origin);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(lead.email||"").trim()))return json({error:"invalid_lead_email"},422,origin);
  const history=Array.isArray(lead.communication)?lead.communication:[];
  if(history.some(x=>x.request_id===b.request_id))return json({ok:true,already_sent:true},200,origin);
  const resendKey=Deno.env.get("RESEND_API_KEY");if(!resendKey)return json({error:"resend_not_configured"},503,origin);
  const message=b.message.trim();
  const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+resendKey,"Content-Type":"application/json","Idempotency-Key":b.request_id},body:JSON.stringify({from:"Opravao.cz <info@opravao.cz>",to:[lead.email],reply_to:"info@opravao.cz",subject:"Re: Vaše poptávka opravy – Opravao.cz [OPRAVAO:"+lead.id+"]",text:"Dobrý den,\n\n"+message+"\n\nOpravao.cz"})});
  const sentData=await sent.json().catch(()=>({}));if(!sent.ok)return json({error:"email_send_failed",detail:sentData.message||"Odeslání selhalo"},502,origin);
  const entry={type:"outgoing",channel:"email",body:message,created_at:new Date().toISOString(),request_id:b.request_id,provider_id:sentData.id||null,from:"info@opravao.cz",to:lead.email};
  const saved=await rest(base,key,"plotao_leads?id=eq."+b.id+"&source=eq.opravao.cz",{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify({communication:[...history,entry],status:lead.status==="new"?"contacted":lead.status,updated_at:new Date().toISOString()})});
  if(!saved.ok)return json({ok:true,warning:"email_sent_history_not_saved"},200,origin);
  await audit(base,key,actor,action,"lead",b.id,{recipient:lead.email,provider_id:sentData.id});
  return json({ok:true},200,origin);
 }
 if(action==="update_lead"){
  if(!safeId(b.id))return json({error:"invalid_id"},422,origin);
  const check=await rest(base,key,"plotao_leads?id=eq."+b.id+"&source=eq.opravao.cz&select=id");
  if(!check.ok)return fail(check); if(!check.data?.length)return json({error:"lead_not_found"},404,origin);
  const patch={updated_at:new Date().toISOString()};
  if(b.status!==undefined){if(!STATUSES.has(b.status))return json({error:"invalid_status"},422,origin);patch.status=b.status}
  if(b.assigned_to!==undefined)patch.assigned_to=str(b.assigned_to,120);
  if(b.partner_name!==undefined)patch.partner_name=str(b.partner_name,160);
  if(b.next_action!==undefined)patch.next_action=str(b.next_action,500);
  if(b.next_action_at!==undefined)patch.next_action_at=b.next_action_at?str(b.next_action_at,50):null;
  if(b.outcome!==undefined)patch.outcome=str(b.outcome,1000);
  const r=await rest(base,key,"plotao_leads?id=eq."+b.id+"&source=eq.opravao.cz",{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify(patch)});
  if(!r.ok)return fail(r); await audit(base,key,actor,action,"lead",b.id,patch); return json({data:r.data?.[0]},200,origin);
 }
 if(action==="convert_registration"){
if(!safeId(b.lead_id))return json({error:"invalid_id"},422,origin);
const lr=await rest(base,key,"plotao_leads?id=eq."+b.lead_id+"&source=eq.opravao.cz&select=id,payload,status");if(!lr.ok)return fail(lr);
const lead=lr.data?.[0],d=lead?.payload||{};if(!lead||d.registrationType!=="company")return json({error:"registration_not_found"},404,origin);
const company_name=str(d.company,160),contact_name=str(d.contactName,120),email=str(d.email,254).toLowerCase(),ico=str(d.ico,8);
if(company_name.length<2||!/^\S+@\S+\.\S+$/.test(email)||!/^\d{8}$/.test(ico))return json({error:"invalid_registration_data"},422,origin);
const specialization=str(d.specialization,600),repair_types=[...new Set(specialization.split("|").map(x=>x.trim().replace(/^jiný:\s*/i,"").trim()).filter(x=>x.length>=2).map(x=>x.slice(0,80)))].slice(0,26);
const region=str(d.region,80),allRegions=["Hlavní město Praha","Středočeský kraj","Jihočeský kraj","Plzeňský kraj","Karlovarský kraj","Ústecký kraj","Liberecký kraj","Královéhradecký kraj","Pardubický kraj","Kraj Vysočina","Jihomoravský kraj","Olomoucký kraj","Zlínský kraj","Moravskoslezský kraj"],regions=region==="Celá Česká republika"?allRegions:[region];
const found=await rest(base,key,"opravao_partners?or=(ico.eq."+encodeURIComponent(ico)+",email.eq."+encodeURIComponent(email)+")&select=*&limit=1");if(!found.ok)return fail(found);
const old=found.data?.[0];if(old&&String(old.ico||"")===ico&&String(old.email||"").toLowerCase()!==email)return json({error:"registration_conflict",detail:"Toto IČO už má v evidenci jiný e-mail. Profil nebyl změněn; ověřte údaje žádosti a opraváře ručně."},409,origin);const wasArchived=!!old?.archived_at;const preserve=!!old&&!wasArchived&&["approved","paused","rejected"].includes(old.status);const row={company_name,contact_name,email,phone:str(d.phone,40),ico,regions,repair_types,billing_email:email,notes:"Žádost z registračního formuláře."+(str(d.note,1000)?" "+str(d.note,1000):""),archived_at:null,updated_at:new Date().toISOString()};
let saved;if(old){Object.assign(row,{status:preserve?old.status:"pending",active:preserve?old.active:false,price_per_lead:Number(old.price_per_lead)||149,map_latitude:old.map_latitude??null,map_longitude:old.map_longitude??null,map_visible:preserve&&old.map_visible===true});const r=await rest(base,key,"opravao_partners?id=eq."+old.id,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify(row)});if(!r.ok)return fail(r);saved=r.data?.[0]}else{Object.assign(row,{registration_origin:"self_registered",registration_lead_id:lead.id,registered_by:null,status:"pending",active:false,price_per_lead:149,map_latitude:null,map_longitude:null,map_visible:false});const r=await rest(base,key,"opravao_partners",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify(row)});if(!r.ok)return fail(r);saved=r.data?.[0]}
if(!saved?.id)return json({error:"partner_save_failed"},500,origin);
const marked=await rest(base,key,"plotao_leads?id=eq."+lead.id+"&source=eq.opravao.cz",{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify({status:lead.status==="new"?"review":lead.status,updated_at:new Date().toISOString()})});if(!marked.ok)return fail(marked);
await audit(base,key,actor,action,"partner",saved.id,{lead_id:lead.id,ico,email});return json({data:saved},200,origin)
}
if(action==="archive_partner"||action==="restore_partner"||action==="delete_partner"){
 if(!safeId(b.id))return json({error:"invalid_id"},422,origin);
 const found=await rest(base,key,"opravao_partners?id=eq."+b.id+"&select=id,company_name,archived_at");if(!found.ok)return fail(found);if(!found.data?.length)return json({error:"partner_not_found"},404,origin);
 if(action==="delete_partner"){
  if(!found.data[0].archived_at)return json({error:"partner_must_be_archived_first",detail:"Nejprve opraváře přesuňte do koše."},409,origin);
  const [ds,rv]=await Promise.all([rest(base,key,"opravao_lead_distribution?partner_id=eq."+b.id+"&select=id&limit=1"),rest(base,key,"opravao_revenue?partner_id=eq."+b.id+"&select=id&limit=1")]);if(!ds.ok)return fail(ds);if(!rv.ok)return fail(rv);
  if(ds.data?.length||rv.data?.length)return json({error:"partner_has_history",detail:"Opravář má navázané předané poptávky nebo fakturační záznamy; kvůli historii jej nelze trvale vymazat."},409,origin);
  const gone=await rest(base,key,"opravao_partners?id=eq."+b.id,{method:"DELETE",headers:{"Prefer":"return=representation"}});if(!gone.ok)return fail(gone);await audit(base,key,actor,action,"partner",b.id,{});return json({ok:true},200,origin)
 }
 const archived_at=action==="archive_partner"?new Date().toISOString():null;
 const saved=await rest(base,key,"opravao_partners?id=eq."+b.id,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify({archived_at,...(archived_at?{active:false,map_visible:false}:{}),updated_at:new Date().toISOString()})});if(!saved.ok)return fail(saved);await audit(base,key,actor,action,"partner",b.id,{archived_at});return json({data:saved.data?.[0]},200,origin)
}
if(action==="save_partner"){
  const p=b.partner||{};
  const company_name=str(p.company_name,160),email=str(p.email,254).toLowerCase();
  if(company_name.length<2||!/^\S+@\S+\.\S+$/.test(email))return json({error:"invalid_partner"},422,origin);
  const regions=Array.isArray(p.regions)?[...new Set(p.regions.map(x=>str(x,80)).filter(Boolean))].slice(0,14):[];
  const repair_types=Array.isArray(p.repair_types)?[...new Set(p.repair_types.map(x=>str(x,80)).filter(Boolean))].slice(0,26):[];
  const price=Number(p.price_per_lead??149);
  if(!Number.isFinite(price)||price<0||price>100000)return json({error:"invalid_price"},422,origin);
  const map_latitude=p.map_latitude===""||p.map_latitude===null||p.map_latitude===undefined?null:Number(p.map_latitude),map_longitude=p.map_longitude===""||p.map_longitude===null||p.map_longitude===undefined?null:Number(p.map_longitude);
  if(map_latitude!==null&&(!Number.isFinite(map_latitude)||map_latitude<48.5||map_latitude>51.1)||map_longitude!==null&&(!Number.isFinite(map_longitude)||map_longitude<12||map_longitude>18.9))return json({error:"invalid_map_coordinates"},422,origin);
  const row={company_name,contact_name:str(p.contact_name,120),email,phone:str(p.phone,40),ico:str(p.ico,20),regions,repair_types,active:p.active===true,status:["pending","approved","paused","rejected"].includes(p.status)?p.status:"pending",price_per_lead:price,billing_email:str(p.billing_email,254),notes:str(p.notes,2000),map_label:str(p.map_label,80)||null,website:(()=>{const raw=str(p.website,300).trim();if(!raw)return null;try{const u=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}})(),map_latitude,map_longitude,map_visible:p.map_visible===true&&map_latitude!==null&&map_longitude!==null,updated_at:new Date().toISOString()};
  const id=str(p.id,36);
  if(id&&!safeId(id))return json({error:"invalid_id"},422,origin);
  if(!id)Object.assign(row,{registration_origin:"admin",registered_by:actor,registration_lead_id:null});
  const path=id&&safeId(id)?"opravao_partners?id=eq."+id:"opravao_partners";
  const r=await rest(base,key,path,{method:id?"PATCH":"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify(row)});
  if(!r.ok)return fail(r); const saved=r.data?.[0]; await audit(base,key,actor,action,"partner",saved?.id||id,row); return json({data:saved},200,origin);
 }
 if(action==="create_distribution"){
  if(!safeId(b.lead_id)||!safeId(b.partner_id))return json({error:"invalid_id"},422,origin);
  const lead=await rest(base,key,"plotao_leads?id=eq."+b.lead_id+"&source=eq.opravao.cz&select=id,payload,place,region");
  if(!lead.ok)return fail(lead); if(!lead.data?.length)return json({error:"lead_not_found"},404,origin);
  const partner=await rest(base,key,"opravao_partners?id=eq."+b.partner_id+"&status=eq.approved&active=eq.true&select=id,company_name,price_per_lead");
  if(!partner.ok)return fail(partner); if(!partner.data?.length)return json({error:"partner_unavailable"},409,origin);
  const count=await rest(base,key,"opravao_lead_distribution?lead_id=eq."+b.lead_id+"&status=not.in.(declined,expired,refunded)&select=id");
  if(!count.ok)return fail(count);
  const pricing=await rest(base,key,"opravao_settings?key=eq.lead_pricing&select=value");
  if(!pricing.ok)return fail(pricing);
  const maxPartners=Math.max(1,Math.min(3,Number(pricing.data?.[0]?.value?.max_partners_per_lead||3)));
  if((count.data?.length||0)>=maxPartners)return json({error:"partner_limit_reached"},409,origin);
  const price=Number(partner.data[0].price_per_lead);
  const r=await rest(base,key,"opravao_lead_distribution",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({lead_id:b.lead_id,partner_id:b.partner_id,status:"offered",price,note:str(b.note,1000)})});
  if(!r.ok)return fail(r); await audit(base,key,actor,action,"distribution",r.data?.[0]?.id||"",{lead_id:b.lead_id,partner_id:b.partner_id,price}); return json({data:r.data?.[0]},201,origin);
 }
 if(action==="update_distribution"){
  if(!safeId(b.id)||!["offered","accepted","declined","expired","invoiced","paid","refunded"].includes(b.status))return json({error:"invalid_distribution"},422,origin);
  const old=await rest(base,key,"opravao_lead_distribution?id=eq."+b.id+"&select=id,lead_id,partner_id,price,status");
  if(!old.ok)return fail(old); if(!old.data?.length)return json({error:"not_found"},404,origin);
  const d=old.data[0]; const p={status:b.status,updated_at:new Date().toISOString(),note:str(b.note,1000)};
  if(b.status==="accepted"&&!d.accepted_at)p.accepted_at=new Date().toISOString();
  const r=await rest(base,key,"opravao_lead_distribution?id=eq."+b.id,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify(p)});
  if(!r.ok)return fail(r);
  if(b.status==="accepted"&&d.status!=="accepted"){
   const has=await rest(base,key,"opravao_revenue?distribution_id=eq."+b.id+"&select=id");
   if(!has.ok)return fail(has);
   if(!has.data?.length){
    const revenue=await rest(base,key,"opravao_revenue",{method:"POST",body:JSON.stringify({partner_id:d.partner_id,lead_id:d.lead_id,distribution_id:b.id,kind:"qualified_lead",amount:d.price,status:"pending",note:"Účtováno při přijetí kvalifikované poptávky."})});
    if(!revenue.ok)return fail(revenue);
   }
  }
  await audit(base,key,actor,action,"distribution",b.id,p); return json({data:r.data?.[0]},200,origin);
 }
 if(action==="create_revenue"){
  if(!TYPES.has(b.kind))return json({error:"invalid_kind"},422,origin);
  const amount=Number(b.amount); if(!Number.isFinite(amount)||amount<0||amount>10000000)return json({error:"invalid_amount"},422,origin);
  if(b.lead_id&&!safeId(b.lead_id)||b.partner_id&&!safeId(b.partner_id))return json({error:"invalid_id"},422,origin);
  const row={kind:b.kind,amount,status:"pending",partner_id:b.partner_id||null,lead_id:b.lead_id||null,note:str(b.note,1000),due_at:b.due_at||null};
  const r=await rest(base,key,"opravao_revenue",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify(row)});
  if(!r.ok)return fail(r); await audit(base,key,actor,action,"revenue",r.data?.[0]?.id||"",row); return json({data:r.data?.[0]},201,origin);
 }
 if(action==="update_revenue"){
  if(!safeId(b.id)||!["pending","invoiced","paid","overdue","cancelled","refunded"].includes(b.status))return json({error:"invalid_revenue"},422,origin);
  const patch={status:b.status,updated_at:new Date().toISOString(),invoice_ref:str(b.invoice_ref,100),note:str(b.note,1000)};
  if(b.status==="paid")patch.paid_at=new Date().toISOString();
  const r=await rest(base,key,"opravao_revenue?id=eq."+b.id,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify(patch)});
  if(!r.ok)return fail(r); await audit(base,key,actor,action,"revenue",b.id,patch); return json({data:r.data?.[0]},200,origin);
 }
 if(action==="save_settings"){
  if(!b.value||typeof b.value!=="object"||Array.isArray(b.value))return json({error:"invalid_settings"},422,origin);
  const allowed=["lead_pricing","business_model"]; if(!allowed.includes(b.key))return json({error:"invalid_key"},422,origin);
  const r=await rest(base,key,"opravao_settings?on_conflict=key",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=representation"},body:JSON.stringify({key:b.key,value:b.value,updated_at:new Date().toISOString()})});
  if(!r.ok)return fail(r); await audit(base,key,actor,action,"settings",b.key,{value:b.value}); return json({data:r.data?.[0]},200,origin);
 }
 return json({error:"unknown_action"},404,origin);
});
async function audit(base,key,actor,action,entity,entity_id,details){
 await rest(base,key,"opravao_admin_audit",{method:"POST",body:JSON.stringify({actor_email:actor,action,entity,entity_id,details})});
}