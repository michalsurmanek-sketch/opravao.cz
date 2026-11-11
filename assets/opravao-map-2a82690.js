
(async()=>{
 const status=document.querySelector('#location-status'),confirm=document.querySelector('#location-confirm'),selected=document.querySelector('#location-selected'),results=document.querySelector('#location-results');
if(!window.L){status.textContent='Mapu se nepodařilo načíst. Místo můžete zadat přímo do pole Město / PSČ.';return;}
const map=L.map('repair-map',{scrollWheelZoom:false}).setView([49.82,15.47],7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
let marker=null,location=null,companies=[],previewCompany=null,timer,controller,version=0,companyLayer=L.layerGroup().addTo(map);const companyMapIcon=L.divIcon({className:"company-map-marker",html:'<span class="company-map-marker-core" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7M5.5 9v11h13V9M10 20v-6h4v6"/></svg></span>',iconSize:[38,38],iconAnchor:[19,19]});
const directoryStatus=document.createElement("p");directoryStatus.id="company-map-status";directoryStatus.setAttribute("role","status");directoryStatus.style.cssText="font-size:13px;color:#52665a;line-height:1.45;margin:0";document.querySelector(".location-panel")?.append(directoryStatus);
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("cs");
const escapeHtml=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function distanceKm(a,b){const rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function showCompanies(){
 companyLayer.clearLayers();const type=document.querySelector("#type")?.value||"",center=location;if(!center){directoryStatus.textContent="Vyberte místo a na mapě se zobrazí firmy v okolí.";return}
 const nearby=companies.filter(c=>distanceKm(center,{lat:c.lat,lon:c.lon})<=50),found=type?nearby.filter(c=>c.services.some(s=>norm(s)===norm(type))):nearby;
 const sameAsPreview=c=>previewCompany&&norm(c.name)===norm(previewCompany.name)&&Math.abs(c.lat-previewCompany.lat)<0.00001&&Math.abs(c.lon-previewCompany.lon)<0.00001;
 const publicFound=found.filter(c=>!sameAsPreview(c));
 const addMarker=(c)=>{const services=c.services.join(", "),marker=L.marker([c.lat,c.lon],{icon:companyMapIcon,title:c.name,alt:"Firma: "+c.name});marker.bindTooltip(escapeHtml(c.name),{permanent:publicFound.length+(previewCompany?1:0)<=8,direction:"right",offset:[19,0],sticky:true,opacity:.98,className:"company-map-label"});marker.bindPopup("<strong>"+escapeHtml(c.name)+"</strong><br>"+escapeHtml(services)+(c.website?'<br><a href="'+escapeHtml(c.website)+'" target="_blank" rel="noopener noreferrer">Navštívit web firmy ↗</a>':""));marker.addTo(companyLayer)};
 publicFound.forEach(addMarker);
 if(previewMode&&previewCompany)addMarker(previewCompany);
 const points=[[center.lat,center.lon],...publicFound.map(c=>[c.lat,c.lon]),...(previewMode&&previewCompany?[[previewCompany.lat,previewCompany.lon]]:[])];
 if(points.length>1)map.fitBounds(L.latLngBounds(points),{padding:[44,44],maxZoom:13,animate:false});else map.setView([center.lat,center.lon],13,{animate:false});
 if(previewMode&&previewCompany)directoryStatus.textContent="Náhled z administrace: na mapě je "+previewCompany.name+". Značka se zobrazuje pouze v tomto náhledu a nemění zveřejnění firmy.";
 else directoryStatus.textContent=type?(found.length?found.length+" firma/firem pro službu „"+type+"“ do 50 km.":"Zatím jsme nenašli schválené firmy pro službu „"+type+"“ do 50 km."):(found.length?found.length+" firma/firem do 50 km. Vyberte typ opravy pro zúžení výsledků.":"V okolí 50 km zatím není žádná schválená firma s polohou.");
}
fetch("https://jmukoccjqykyoqsypuwb.supabase.co/functions/v1/opravao-directory",{headers:{apikey:"sb_publishable_FSrTbgu1LeF9DNeam3ztwA_3dNHGq-V"}}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{companies=Array.isArray(data.companies)?data.companies:[];showCompanies()}).catch(()=>{directoryStatus.textContent="Seznam firem na mapě se teď nepodařilo načíst."});
const previewParams=new URLSearchParams(window.location.search),previewMode=previewParams.get("mapPreview")==="1";
if(previewMode){
 const lat=Number(previewParams.get("lat")),lon=Number(previewParams.get("lon")),service=previewParams.get("service")||"";
 if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=48.5&&lat<=51.1&&lon>=12&&lon<=18.9){
  const typeSelect=document.querySelector("#type");
  if(typeSelect&&service){const option=[...typeSelect.options].find(o=>norm(o.value||o.textContent)===norm(service));if(option)typeSelect.value=option.value||option.textContent;}
  previewCompany={lat,lon,name:previewParams.get("company")||"Kontrolovaná firma",services:(previewParams.get("services")||service).split("|").map(x=>x.trim()).filter(Boolean),website:previewParams.get("website")||""};
  choose(lat,lon,"Náhled firmy: "+previewCompany.name);
 }
}
document.querySelector("#type")?.addEventListener("change",showCompanies);
const query=document.querySelector('#location-query'),cache=new Map();
function cancelSearch(){clearTimeout(timer);controller?.abort();version++;results.replaceChildren();status.textContent='';}
document.addEventListener('opravao:locating',cancelSearch);
function choose(lat,lon,label){cancelSearch();location={lat,lon,label};showCompanies();if(marker)marker.remove();marker=L.marker([lat,lon],{icon:L.divIcon({className:'location-marker',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(map);selected.textContent=label;confirm.disabled=false;}
map.on('click',e=>choose(e.latlng.lat,e.latlng.lng,'Bod na mapě: '+e.latlng.lat.toFixed(5)+', '+e.latlng.lng.toFixed(5)));
const applyMapLocation=detail=>{const {lat,lon,label}=detail;query.value=label;choose(lat,lon,label);};document.addEventListener('opravao:location',e=>applyMapLocation(e.detail));if(window.opravaoPendingMapLocation)applyMapLocation(window.opravaoPendingMapLocation);
query.setAttribute('autocomplete','off');query.setAttribute('aria-controls','location-results');
async function suggest(autoSelect=false){
const q=query.value.trim(),ticket=++version;controller?.abort();results.replaceChildren();
if(q.length<2){status.textContent='Napište alespoň 2 znaky.';return;}
controller=new AbortController();status.textContent='';
try{
let data=cache.get(q.toLowerCase());
if(!data){
 const response=await fetch('https://photon.komoot.io/api/?limit=8&bbox=12.09,48.55,18.87,51.06&q='+encodeURIComponent(q),{signal:controller.signal});
 if(!response.ok)throw Error('search unavailable');
 data=await response.json();cache.set(q.toLowerCase(),data);
}
if(ticket!==version)return;
const seen=new Set();
const items=(data.features||[]).filter(x=>{
 if(x.properties.countrycode?.toUpperCase()!=='CZ'||!Array.isArray(x.geometry?.coordinates))return false;
 const p=x.properties,key=[p.name,p.city,p.postcode,p.state].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ');
 if(seen.has(key))return false;seen.add(key);return true;
});
const selectItem=item=>{
 const p=item.properties,label=[p.name,p.city,p.postcode,p.state].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ');
 const [lon,lat]=item.geometry.coordinates;
 query.value=label;choose(lat,lon,label);results.replaceChildren();
 
};
if(autoSelect&&items.length===1){selectItem(items[0]);return;}
if(autoSelect&&items.length>1){
 const normalized=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const exact=items.filter(x=>normalized(x.properties.name)===normalized(q)||normalized(x.properties.postcode)===normalized(q));
 if(exact.length===1){selectItem(exact[0]);return;}
}
items.forEach(item=>{
 const p=item.properties,label=[p.name,p.city,p.postcode,p.state].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ');
 const button=document.createElement('button');button.type='button';button.className='location-result';button.textContent=label;
 button.addEventListener('click',()=>{clearTimeout(timer);controller?.abort();version++;selectItem(item);});
 results.append(button);
});
status.textContent=items.length?'':'Místo nenalezeno. Upřesněte název nebo vyberte bod v mapě.';
}catch(error){if(error.name!=='AbortError'&&ticket===version)status.textContent='Vyhledávání je dočasně nedostupné. Zkuste to znovu nebo vyberte bod v mapě.';}
}
query.addEventListener('input',()=>{cancelSearch();location=null;confirm.disabled=true;timer=setTimeout(suggest,550);});
query.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('button')?.focus();}if(e.key==='Escape'){clearTimeout(timer);controller?.abort();version++;results.replaceChildren();}});
results.addEventListener('keydown',e=>{const buttons=[...results.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(e.key==='Escape'){results.replaceChildren();query.focus();}});
document.querySelector('#location-search').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);suggest(true);});
confirm.addEventListener('click',()=>{if(!location)return;const place=document.querySelector('#place');place.value=location.label;place.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#poptavka').scrollIntoView({behavior:'smooth',block:'start'});});
// Geolocation is handled independently so it also works when Leaflet fails to load.
if('ResizeObserver' in window)new ResizeObserver(()=>map.invalidateSize()).observe(document.querySelector('#repair-map'));window.addEventListener('load',()=>map.invalidateSize());
})();
