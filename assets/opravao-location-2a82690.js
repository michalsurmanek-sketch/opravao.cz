
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

const placeSuggestions=document.querySelector('#place-suggestions'),placeFeedback=document.querySelector('#place-location-feedback');
window.opravaoAddressLocation=null;
let addressTimer=null,addressController=null,addressSearchVersion=0;
const addressLabel=properties=>{
 const street=properties.street?properties.street+(properties.housenumber?' '+properties.housenumber:''):properties.name||'';
 const city=properties.city||properties.town||properties.village||properties.municipality||properties.district||'';
 return [street,properties.postcode,city,properties.state].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ');
};
const clearAddressSuggestions=()=>{placeSuggestions?.replaceChildren();placeInput.setAttribute('aria-expanded','false');};
placeInput.setAttribute('aria-haspopup','listbox');
placeInput.addEventListener('input',()=>{
 window.opravaoAddressLocation=null;
 placeFeedback.textContent='';
 clearTimeout(addressTimer);addressController?.abort();clearAddressSuggestions();
 const query=placeInput.value.trim(),ticket=++addressSearchVersion;
 if(query.length<4)return;
 addressTimer=setTimeout(async()=>{
   addressController=new AbortController();
   const loading=document.createElement('p');loading.textContent='Hledám adresu…';placeSuggestions.append(loading);placeInput.setAttribute('aria-expanded','true');
   try{
     const response=await fetch('https://photon.komoot.io/api/?limit=7&bbox=12.09,48.55,18.87,51.06&q='+encodeURIComponent(query),{signal:addressController.signal});
     if(!response.ok)throw Error('address_search_unavailable');
     const data=await response.json();if(ticket!==addressSearchVersion)return;
     const seen=new Set(),items=(data.features||[]).filter(item=>item.properties?.countrycode?.toUpperCase()==='CZ'&&Array.isArray(item.geometry?.coordinates)).map(item=>({item,label:addressLabel(item.properties)})).filter(x=>x.label&&!seen.has(x.label)&&seen.add(x.label));
     placeSuggestions.replaceChildren();
     if(!items.length){const empty=document.createElement('p');empty.textContent='Adresu se nepodařilo najít. Doplňte ulici a číslo domu, případně obec.';placeSuggestions.append(empty);return;}
     for(const {item,label} of items){
       const option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.textContent=label;
       option.addEventListener('pointerdown',event=>event.preventDefault());
       option.addEventListener('click',()=>{
         const [lon,lat]=item.geometry.coordinates;
         placeInput.value=label;
         window.opravaoAddressLocation={lat:Number(lat),lon:Number(lon),label,source:'address',region:item.properties?.state||''};
         placeFeedback.textContent='Adresa vybrána; její GPS bod se uloží k poptávce.';
         clearAddressSuggestions();
       });
       placeSuggestions.append(option);
     }
     placeInput.setAttribute('aria-expanded','true');
   }catch(error){if(error.name!=='AbortError'&&ticket===addressSearchVersion){placeSuggestions.replaceChildren();const msg=document.createElement('p');msg.textContent='Našeptávač je teď nedostupný. Adresu můžete zadat ručně a poptávku přesto odeslat.';placeSuggestions.append(msg);placeInput.setAttribute('aria-expanded','true');}}
 },450);
});
placeInput.addEventListener('keydown',event=>{
 const options=[...placeSuggestions.querySelectorAll('button')],index=options.indexOf(document.activeElement);
 if(event.key==='ArrowDown'&&options.length){event.preventDefault();options[0].focus();}
 if(event.key==='Escape')clearAddressSuggestions();
 if(event.key==='ArrowDown'&&index>=0){event.preventDefault();options[Math.min(index+1,options.length-1)]?.focus();}
 if(event.key==='ArrowUp'&&index>0){event.preventDefault();options[index-1].focus();}
});
document.addEventListener('click',event=>{if(!placeInput.closest('.field')?.contains(event.target))clearAddressSuggestions();});

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
        location:window.opravaoAddressLocation,
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
