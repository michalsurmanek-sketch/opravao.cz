
const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('.nav');
function setMenuOpen(open){
  nav.classList.toggle('open',open);
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Zavřít menu':'Otevřít menu');
}
toggle.addEventListener('click',()=>setMenuOpen(toggle.getAttribute('aria-expanded')!=='true'));
document.addEventListener('click',event=>{
  if(toggle.getAttribute('aria-expanded')==='true'&&!nav.contains(event.target)&&!toggle.contains(event.target))setMenuOpen(false);
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true')setMenuOpen(false)});
document.querySelectorAll('.service').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.service').forEach(b=>b.setAttribute('aria-pressed','false'));button.setAttribute('aria-pressed','true');document.querySelector('#lokalita').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});}));
const SUPABASE_URL='https://jmukoccjqykyoqsypuwb.supabase.co';
const SUPABASE_PUBLIC_KEY='sb_publishable_FSrTbgu1LeF9DNeam3ztwA_3dNHGq-V';
const repairForm=document.querySelector('#repair-form');
const statusMessage=document.querySelector('#status');
const placeInput=document.querySelector('#place');
const placeLocate=document.querySelector('#place-geolocate');
// Both GPS buttons use the same native geolocation flow, without extra layers.
async function locateUser(button,field,status,updateMap=false){
 if(!window.isSecureContext){status.textContent='Pro zjištění polohy otevřete web přes HTTPS.';return;}
 if(!navigator.geolocation){status.textContent='Prohlížeč nepodporuje zjišťování polohy.';return;}
 button.disabled=true;
 status.textContent='Zjišťuji polohu… Povolte přístup v prohlížeči.';
 try{
  const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:20000,maximumAge:120000}));
  const lat=position.coords.latitude,lon=position.coords.longitude;
  const coordinates='Moje poloha: '+lat.toFixed(5)+', '+lon.toFixed(5);
  field.value=coordinates;
  field.dispatchEvent(new Event('input',{bubbles:true}));
  if(updateMap){window.opravaoPendingMapLocation={lat,lon,label:coordinates};document.dispatchEvent(new CustomEvent('opravao:location',{detail:window.opravaoPendingMapLocation}));}
  status.textContent='Poloha nalezena. Dohledávám adresu…';
  try{
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),10000);
   let response;
   try{response=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1&accept-language=cs&lat='+lat+'&lon='+lon,{signal:controller.signal});}
   finally{clearTimeout(timer);}
   if(!response.ok)throw Error('Geocoding failed');
   const data=await response.json(),a=data.address||{};
   const town=a.city||a.town||a.village||a.municipality||a.hamlet||a.suburb;
   const label=[town,a.postcode].filter(Boolean).join(', ')||data.display_name;
   if(!label)throw Error('No address');
   field.value=label;field.dispatchEvent(new Event('input',{bubbles:true}));
   if(updateMap){window.opravaoPendingMapLocation={lat,lon,label};document.dispatchEvent(new CustomEvent('opravao:location',{detail:window.opravaoPendingMapLocation}));}
   status.textContent='';
  }catch{status.textContent='Poloha byla nalezena, ale adresu nelze dohledat. Můžete zadat obec ručně.';}
 }catch(error){
  status.textContent=error.code===1?'Přístup k poloze byl zamítnut. Povolte polohu pro opravao.cz v prohlížeči.':error.code===3?'Zjištění polohy vypršelo. Zapněte polohu v telefonu a zkuste to znovu.':'Polohu se nepodařilo zjistit. Zkontrolujte GPS a oprávnění prohlížeče.';
 }finally{button.disabled=false;}
}
placeLocate.addEventListener('click',()=>locateUser(placeLocate,placeInput,document.querySelector('#place-location-feedback'),true));
const mapLocate=document.querySelector('#location-geolocate');
const mapQuery=document.querySelector('#location-query');
const mapStatus=document.querySelector('#map-location-feedback');
if(mapLocate&&mapQuery&&mapStatus)mapLocate.addEventListener('click',()=>locateUser(mapLocate,mapQuery,mapStatus,true));
repairForm.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!repairForm.reportValidity())return;
  const button=repairForm.querySelector('button[type="submit"]');
  const originalLabel=button.innerHTML;
  button.disabled=true;
  button.textContent='Odesílám…';
  statusMessage.textContent='';
  try{
    const response=await fetch(SUPABASE_URL+'/functions/v1/submit-opravao-lead',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLIC_KEY},
      body:JSON.stringify({source:'opravao.cz',transportVersion:1,lead:{
        repairType:document.querySelector('#type').value,
        place:document.querySelector('#place').value,
        contact:document.querySelector('#contact').value
      }})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===429)throw new Error('Přijali jsme několik pokusů. Zkuste to prosím znovu za chvíli.');
      if(response.status===422){
        const reason=result.error;
        if(reason==='invalid_contact')throw new Error('Zadejte platné telefonní číslo (alespoň 9 číslic) nebo e-mail.');
        if(reason==='invalid_repair_type')throw new Error('Vyberte prosím typ opravy z nabídky.');
        if(reason==='invalid_place')throw new Error('Zadejte prosím město nebo PSČ.');
        throw new Error('Zkontrolujte vyplněné údaje a zkuste poptávku znovu.');
      }
      if(response.status===503)throw new Error('Odesílání je momentálně nedostupné. Zkuste to prosím za chvíli.');
      throw new Error('Poptávku se teď nepodařilo odeslat (chyba '+response.status+'). Zkuste to prosím znovu.');
    }
    repairForm.reset();
    document.querySelectorAll('.service').forEach(b=>b.setAttribute('aria-pressed','false'));
    statusMessage.textContent='Děkujeme, poptávka byla odeslána.';
  }catch(error){
    statusMessage.textContent=error instanceof Error?error.message:'Poptávku se teď nepodařilo odeslat. Zkuste to prosím znovu.';
  }finally{
    button.disabled=false;
    button.innerHTML=originalLabel;
  }
});
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
