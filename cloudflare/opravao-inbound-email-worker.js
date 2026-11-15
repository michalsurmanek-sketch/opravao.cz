// Forward to the mailbox and mirror authenticated replies into the admin history.
const ENDPOINT="https://jmukoccjqykyoqsypuwb.supabase.co/functions/v1/opravao-inbound-email";
const MAX_RAW_BYTES=12_000_000;
function base64(buffer){const a=new Uint8Array(buffer);let out="";for(let i=0;i<a.length;i+=16384)out+=String.fromCharCode(...a.subarray(i,i+16384));return btoa(out)}
export default {
 async email(message,env,ctx){
  const auth=message.headers.get("Authentication-Results")||"";
  const trusted=/^\s*mx\.cloudflare\.net\s*;/i.test(auth)&&/\b(?:dmarc|dkim)\s*=\s*pass\b/i.test(auth);
  let raw=null,reason="";
  if(!env.OPRAVAO_INBOUND_TOKEN)reason="missing_token";
  else if(!trusted)reason="authentication_not_passed";
  else if(message.rawSize>MAX_RAW_BYTES)reason="message_too_large";
  else {try{raw=await new Response(message.raw).arrayBuffer()}catch{reason="raw_read_failed"}}
  // Capture the single-use stream before forwarding. A mirror failure must not block delivery.
  await message.forward("ao-group@seznam.cz");
  if(!raw){console.warn("opravao_mirror_skipped",JSON.stringify({reason,size:message.rawSize,cloudflareAuth:/^\s*mx\.cloudflare\.net\s*;/i.test(auth)}));return}
  const mirror=async()=>{
   try{
    const response=await fetch(ENDPOINT,{method:"POST",headers:{"Authorization":"Bearer "+env.OPRAVAO_INBOUND_TOKEN,"Content-Type":"application/json"},body:JSON.stringify({raw:base64(raw)}),signal:AbortSignal.timeout(25000)});
    const result=await response.json().catch(()=>({}));
    const summary={status:response.status,stored:result.stored,ignored:result.ignored,error:result.error};
    if(!response.ok||result.ignored)console.warn("opravao_mirror_result",JSON.stringify(summary));
    else console.log("opravao_mirror_result",JSON.stringify(summary));
   }catch{console.error("opravao_mirror_network_error")}
  };
  ctx.waitUntil(mirror());
 }
};
