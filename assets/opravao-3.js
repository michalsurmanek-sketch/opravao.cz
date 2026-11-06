
(async()=>{
 const status=document.querySelector('#location-status'),confirm=document.querySelector('#location-confirm'),selected=document.querySelector('#location-selected'),results=document.querySelector('#location-results');
if(!window.L){status.textContent='Mapu se nepodařilo načíst. Místo můžete zadat přímo do pole Město / PSČ.';return;}
const map=L.map('repair-map',{scrollWheelZoom:false}).setView([49.82,15.47],7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
let marker=null,location=null;
function choose(lat,lon,label){location={lat,lon,label};if(marker)marker.remove();marker=L.marker([lat,lon],{icon:L.divIcon({className:'location-marker',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(map);selected.textContent=label;confirm.disabled=false;}
map.on('click',e=>choose(e.latlng.lat,e.latlng.lng,'Bod na mapě: '+e.latlng.lat.toFixed(5)+', '+e.latlng.lng.toFixed(5)));
const applyMapLocation=detail=>{const {lat,lon,label}=detail;choose(lat,lon,label);map.setView([lat,lon],14);};document.addEventListener('opravao:location',e=>applyMapLocation(e.detail));if(window.opravaoPendingMapLocation)applyMapLocation(window.opravaoPendingMapLocation);
const query=document.querySelector('#location-query'),cache=new Map();let timer,controller,version=0;
query.setAttribute('autocomplete','off');query.setAttribute('aria-controls','location-results');
async function suggest(autoSelect=false){
const q=query.value.trim(),ticket=++version;controller?.abort();results.replaceChildren();
if(q.length<2){status.textContent='Napište alespoň 2 znaky.';return;}
controller=new AbortController();
try{
let data=cache.get(q.toLowerCase());
if(!data){
 const response=await fetch('https://photon.komoot.io/api/?limit=8&bbox=12.09,48.55,18.87,51.06&q='+encodeURIComponent(q),{signal:controller.signal});
 if(!response.ok)throw Error('search unavailable');
 data=await response.json();cache.set(q.toLowerCase(),data);
}
if(ticket!==version)return;
const items=(data.features||[]).filter(x=>x.properties.countrycode?.toUpperCase()==='CZ'&&Array.isArray(x.geometry?.coordinates));
const selectItem=item=>{
 const p=item.properties,label=[p.name,p.city,p.postcode,p.state].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ');
 const [lon,lat]=item.geometry.coordinates;
 query.value=label;choose(lat,lon,label);map.setView([lat,lon],13);results.replaceChildren();
 
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
query.addEventListener('input',()=>{clearTimeout(timer);controller?.abort();version++;results.replaceChildren();timer=setTimeout(suggest,550);});
query.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('button')?.focus();}if(e.key==='Escape'){clearTimeout(timer);controller?.abort();version++;results.replaceChildren();}});
results.addEventListener('keydown',e=>{const buttons=[...results.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(e.key==='Escape'){results.replaceChildren();query.focus();}});
document.querySelector('#location-search').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);suggest(true);});
confirm.addEventListener('click',()=>{if(!location)return;const place=document.querySelector('#place');place.value=location.label;place.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#poptavka').scrollIntoView({behavior:'smooth',block:'start'});});
// Geolocation is handled independently so it also works when Leaflet fails to load.
if('ResizeObserver' in window)new ResizeObserver(()=>map.invalidateSize()).observe(document.querySelector('#repair-map'));window.addEventListener('load',()=>map.invalidateSize());
})();
