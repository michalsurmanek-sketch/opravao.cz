// OpravaO incoming email mirror. ALWAYS forward to verified mailbox first.
const ENDPOINT="https://jmukoccjqykyoqsypuwb.supabase.co/functions/v1/opravao-inbound-email";
function base64(buffer){const a=new Uint8Array(buffer);let out="";for(let i=0;i<a.length;i+=16384)out+=String.fromCharCode(...a.subarray(i,i+16384));return btoa(out)}
export default {
 async email(message,env,ctx){
  // Existing mail delivery must not depend on OpravaO chat sync.
  await message.forward("ao-group@seznam.cz");
  if(!env.OPRAVAO_INBOUND_TOKEN)return;
  const auth=message.headers.get("Authentication-Results")||"";
  if(!auth.toLowerCase().includes("mx.cloudflare.net")||!/dmarc=pass|dkim=pass/i.test(auth))return;
  if(message.rawSize>2000000)return;
  try{
   const raw=await new Response(message.raw).arrayBuffer();
   const response=await fetch(ENDPOINT,{method:"POST",headers:{"Authorization":"Bearer "+env.OPRAVAO_INBOUND_TOKEN,"Content-Type":"application/json"},body:JSON.stringify({raw:base64(raw)})});
   if(!response.ok)console.error("OpravaO chat sync failed",response.status);
  }catch(e){console.error("OpravaO chat sync error",String(e))}
 }
};