// Match standard reply headers; never guess a conversation from the sender alone.
export async function findReplyLead(parsed,base,key,resendKey){
 const from=String(parsed.from?.address||"").trim().toLowerCase();
 const refs=[...new Set((String(parsed.inReplyTo||"")+" "+String(parsed.references||"").split(/\s+/).reverse().join(" ")).match(/<[^<>\s]{1,498}>/g)||[])].slice(0,30);
 if(!from||!refs.length)return null;
 const headers={apikey:key,authorization:"Bearer "+key};
 const query=new URLSearchParams({source:"eq.opravao.cz",email:"ilike."+from.replace(/[\\%_*]/g,c=>"\\"+c),select:"id,email,communication",order:"created_at.desc",limit:"100"});
 const response=await fetch(base+"/rest/v1/plotao_leads?"+query,{headers});
 if(!response.ok)throw new Error("thread_lookup_failed");
 const leads=await response.json();
 const candidates=leads.filter(lead=>String(lead.email||"").trim().toLowerCase()===from);
 for(const ref of refs){
  const matches=candidates.filter(lead=>(Array.isArray(lead.communication)?lead.communication:[]).some(entry=>entry.message_id===ref||entry.type==="incoming"&&entry.provider_id===ref));
  if(matches.length===1)return matches[0].id;
  if(matches.length>1)return null;
 }
 // A provider may expose its Message-ID after the send response. Recover it here.
 if(resendKey){
  let checked=0;
  for(const lead of candidates){
   for(const entry of [...(Array.isArray(lead.communication)?lead.communication:[])].reverse()){
    if(entry.type!=="outgoing"||entry.message_id||!/^[0-9a-f-]{36}$/i.test(entry.provider_id||""))continue;
    if(++checked>10)return null;
    const r=await fetch("https://api.resend.com/emails/"+entry.provider_id,{headers:{Authorization:"Bearer "+resendKey},signal:AbortSignal.timeout(5000)});
    if(!r.ok)continue;
    const email=await r.json();
    if(refs.includes(email.message_id))return lead.id;
   }
  }
 }
 return null;
}
