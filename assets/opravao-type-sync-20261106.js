
/* Desktop custom dropdown, mobile keeps native select. */
(()=>{
 const select=document.getElementById('type'),picker=document.getElementById('repair-type-picker');
 if(!select||!picker)return;
 const trigger=picker.querySelector('.repair-type-trigger'),label=document.getElementById('repair-type-label'),panel=document.getElementById('repair-type-options');
 const choices=[...select.options].filter(o=>o.value);
 choices.forEach(option=>{const item=document.createElement('button');item.type='button';item.className='repair-type-option';item.setAttribute('role','option');item.setAttribute('aria-selected','false');item.textContent=option.textContent;item.dataset.value=option.value;panel.append(item);item.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));close();trigger.focus();});});
 const items=[...panel.querySelectorAll('.repair-type-option')];
 const locationHeading=document.getElementById('location-heading');
 const locationPhrases={"Autoservis":"autoservis","Instalatér":"instalatéra","Elektrikář":"elektrikáře","Spotřebiče":"opravu spotřebiče","Dveře a okna":"opravu dveří a oken","Střecha":"opravu střechy","Hodinový manžel":"hodinového manžela","Zedník a obkladač":"zedníka a obkladače","Malíř a natěrač":"malíře a natěrače","Pokrývač a klempíř":"pokrývače a klempíře","Klempíř":"klempíře","Truhlář":"truhláře","Topenář":"topenáře","Ploty a brány":"ploty a brány","Zámečník":"zámečníka","Klimatizace a vzduchotechnika":"klimatizaci a vzduchotechniku","Žaluzie a rolety":"žaluzie a rolety","Sklenář":"sklenáře","Podlahář":"podlaháře","Sádrokartonář":"sádrokartonáře","Fasády a zateplení":"fasádu nebo zateplení","Kominík":"kominíka","Opravy garážových vrat":"opravu garážových vrat","Zahradník":"zahradníka","Úklid a čištění":"úklid a čištění","Výkopové práce":"výkopové práce","Bourací a demoliční práce":"bourací a demoliční práce","Stěhování a vyklízení":"stěhování nebo vyklízení","Počítače a internet":"pomoc s počítačem nebo internetem","Rizikové kácení":"rizikové kácení","Stavební dozor":"stavební dozor","Geodet":"geodeta"};
 function sync(){label.textContent=select.selectedOptions[0]?.textContent||'Vyberte typ opravy';items.forEach(i=>i.setAttribute('aria-selected',String(i.dataset.value===select.value)));if(locationHeading){const name=select.selectedOptions[0]?.textContent?.trim()||select.value;locationHeading.textContent=select.value?'Kde potřebujete '+(locationPhrases[name]||'službu „'+name+'“')+'?':'Kde potřebujete opravu?'}}
 function close(){panel.hidden=true;trigger.setAttribute('aria-expanded','false');}
 function open(){panel.hidden=false;trigger.setAttribute('aria-expanded','true');const selected=items.find(i=>i.dataset.value===select.value);(selected||items[0])?.focus();}
 trigger.addEventListener('click',()=>panel.hidden?open():close());
 trigger.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();open();}});
 panel.addEventListener('keydown',e=>{const idx=items.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();close();trigger.focus();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();items[(idx+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}else if(e.key==='Home'){e.preventDefault();items[0]?.focus();}else if(e.key==='End'){e.preventDefault();items[items.length-1]?.focus();}else if(e.key==='Tab')close();});
 document.addEventListener('click',e=>{if(!picker.contains(e.target))close();});
 select.addEventListener('change',sync);select.addEventListener('invalid',()=>{if(matchMedia('(min-width:851px)').matches){trigger.focus();}});
 document.querySelectorAll('.service').forEach(button=>{
  button.addEventListener('click',()=>{
   const name=button.querySelector('span')?.textContent.replace(/\s+/g,' ').trim();
   const normalize=value=>value.replace(/\s+/g,'').toLocaleLowerCase('cs');
   const option=choices.find(option=>normalize(option.textContent)===normalize(name||''));
   if(!option)return;
   select.value=option.value;
   select.dispatchEvent(new Event('change',{bubbles:true}));
   close();
  });
 });
 select.form?.addEventListener('reset',()=>setTimeout(sync,0));
 sync();
})();
