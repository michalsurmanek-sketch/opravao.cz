
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
document.querySelectorAll('.service').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.service').forEach(b=>b.setAttribute('aria-pressed','false'));button.setAttribute('aria-pressed','true');const heading=document.querySelector('.location-panel-heading'),chosenIcon=document.querySelector('#selected-service-location-icon'),source=button.querySelector('.service-exact-art');if(heading&&chosenIcon&&source&&matchMedia('(min-width:851px)').matches){chosenIcon.src=source.currentSrc||source.src;chosenIcon.alt='Ikona služby '+(button.querySelector('.service-label')?.textContent.trim()||'');chosenIcon.hidden=false;heading.classList.add('has-service-icon')}document.querySelector('#lokalita').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});}));
const SUPABASE_URL='https://jmukoccjqykyoqsypuwb.supabase.co';
const SUPABASE_PUBLIC_KEY='sb_publishable_FSrTbgu1LeF9DNeam3ztwA_3dNHGq-V';
const repairForm=document.querySelector('#repair-form');
const statusMessage=document.querySelector('#status');
const couponOptIn=document.querySelector('#coupon-opt-in'),couponRegionWrap=document.querySelector('#coupon-region-wrap'),couponRegion=document.querySelector('#coupon-region');
couponOptIn?.addEventListener('change',()=>{couponRegionWrap.hidden=!couponOptIn.checked;couponRegion.required=couponOptIn.checked;if(!couponOptIn.checked)couponRegion.value='';});

const placeInput=document.querySelector('#place');
const placeLocate=document.querySelector('#place-geolocate');
let locationRequestVersion=0;
[placeInput,document.querySelector('#location-query')].forEach(field=>field?.addEventListener('input',()=>{locationRequestVersion++;}));
// Both GPS buttons use the same native geolocation flow, without extra layers.
async function locateUser(button,field,status,updateMap=false){
 const ticket=++locationRequestVersion;
 status.textContent='';
 document.querySelector('#place-location-feedback').textContent='';
 document.querySelector('#map-location-feedback').textContent='';
 document.dispatchEvent(new Event('opravao:locating'));
 if(!window.isSecureContext){status.textContent='Pro zjištění polohy otevřete web přes HTTPS.';return;}
 if(!navigator.geolocation){status.textContent='Prohlížeč nepodporuje zjišťování polohy.';return;}
 const buttons=[placeLocate,document.querySelector('#location-geolocate')].filter(Boolean);
 buttons.forEach(control=>{control.disabled=true;control.setAttribute('aria-busy','true');});
 
 try{
  const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:20000,maximumAge:120000}));
  if(ticket!==locationRequestVersion)return;
  const lat=position.coords.latitude,lon=position.coords.longitude;
  const coordinates='Moje poloha: '+lat.toFixed(5)+', '+lon.toFixed(5);
  field.value=coordinates;

  if(updateMap){window.opravaoPendingMapLocation={lat,lon,label:coordinates};document.dispatchEvent(new CustomEvent('opravao:location',{detail:window.opravaoPendingMapLocation}));}
  
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
   if(ticket!==locationRequestVersion)return;
   field.value=label;
   if(updateMap){window.opravaoPendingMapLocation={lat,lon,label};document.dispatchEvent(new CustomEvent('opravao:location',{detail:window.opravaoPendingMapLocation}));}
   status.textContent='';
  }catch{if(ticket!==locationRequestVersion)return;status.textContent='Poloha byla nalezena, ale adresu nelze dohledat. Můžete zadat obec ručně.';}
 }catch(error){
  if(ticket!==locationRequestVersion)return;
  status.textContent=error.code===1?'Přístup k poloze byl zamítnut. Povolte polohu pro opravao.cz v prohlížeči.':error.code===3?'Zjištění polohy vypršelo. Zapněte polohu v telefonu a zkuste to znovu.':'Polohu se nepodařilo zjistit. Zkontrolujte GPS a oprávnění prohlížeče.';
 }finally{buttons.forEach(control=>{control.disabled=false;control.removeAttribute('aria-busy');});}
}
placeLocate?.addEventListener('click',()=>locateUser(placeLocate,placeInput,document.querySelector('#place-location-feedback'),true));
const mapLocate=document.querySelector('#location-geolocate');
const mapQuery=document.querySelector('#location-query');
const mapStatus=document.querySelector('#map-location-feedback');
if(mapLocate&&mapQuery&&mapStatus)mapLocate.addEventListener('click',()=>locateUser(mapLocate,mapQuery,mapStatus,true));

repairForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const repairTypeField=document.querySelector('#type');
  if(!repairTypeField?.value){
    statusMessage.textContent='Vyberte prosím typ opravy.';
    const typeControl=document.querySelector('.repair-type-trigger')||repairTypeField;
    typeControl?.focus();
    return;
  }
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
        contact:document.querySelector('#contact').value,
        email:document.querySelector('#customer-email').value.trim(),
        marketingConsent:!!couponOptIn?.checked,
        marketingRegion:couponOptIn?.checked?couponRegion.value:''
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
    statusMessage.textContent=result.confirmation_sent?'Děkujeme, poptávka byla uložena. Potvrzení jsme vám poslali e-mailem. '+(result.offer_emails_sent>0?'Oslovili jsme '+result.offer_emails_sent+' schválené opraváře.':result.distribution_status==='no_match'?'Pro tuto lokalitu a obor zatím nemáme schváleného opraváře; poptávku prověříme ručně.':'Poptávku předáme k ručnímu zpracování.'):'Poptávka byla uložena, ale potvrzovací e-mail se nepodařilo odeslat. Ozveme se vám co nejdříve.';
  }catch(error){
    statusMessage.textContent=error instanceof Error?error.message:'Poptávku se teď nepodařilo odeslat. Zkuste to prosím znovu.';
  }finally{
    button.disabled=false;
    button.innerHTML=originalLabel;
  }
});
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
