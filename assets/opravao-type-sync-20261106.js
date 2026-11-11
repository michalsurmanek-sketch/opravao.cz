
/* Desktop custom dropdown, mobile keeps native select. */
(()=>{
 const select=document.getElementById('type'),picker=document.getElementById('repair-type-picker');
 if(!select||!picker)return;
 const trigger=picker.querySelector('.repair-type-trigger'),label=document.getElementById('repair-type-label'),panel=document.getElementById('repair-type-options');
 const choices=[...select.options].filter(o=>o.value);
 choices.forEach(option=>{const item=document.createElement('button');item.type='button';item.className='repair-type-option';item.setAttribute('role','option');item.setAttribute('aria-selected','false');item.textContent=option.textContent;item.dataset.value=option.value;panel.append(item);item.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));close();trigger.focus();});});
 const items=[...panel.querySelectorAll('.repair-type-option')];
 const locationHeading=document.getElementById('location-heading');
 const locationPhrases={"Autoservis":"službu autoservisu","Instalatér":"službu instalatéra","Elektrikář":"službu elektrikáře","Spotřebiče":"službu oprav spotřebičů","Dveře a okna":"službu opravy dveří a oken","Střecha":"službu opravy střechy","Hodinový manžel":"službu hodinového manžela","Zedník a obkladač":"službu zedníka a obkladače","Malíř a natěrač":"službu malíře a natěrače","Pokrývač a klempíř":"službu pokrývače a klempíře","Klempíř":"službu klempíře","Truhlář":"službu truhláře","Topenář":"službu topenáře","Ploty a brány":"službu montáže nebo opravy plotů a bran","Zámečník":"službu zámečníka","Klimatizace a vzduchotechnika":"službu montáže nebo opravy klimatizace a vzduchotechniky","Žaluzie a rolety":"službu montáže nebo opravy žaluzií a rolet","Sklenář":"službu sklenáře","Podlahář":"službu podlaháře","Sádrokartonář":"službu sádrokartonáře","Fasády a zateplení":"službu opravy fasády a zateplení","Kominík":"službu kominíka","Opravy garážových vrat":"službu opravy garážových vrat","Zahradník":"službu zahradníka","Úklid a čištění":"službu úklidu a čištění","Výkopové práce":"službu výkopových prací","Bourací a demoliční práce":"službu bouracích a demoličních prací","Stěhování a vyklízení":"službu stěhování a vyklízení","Počítače a internet":"službu s počítačem nebo internetem","Rizikové kácení":"službu rizikového kácení","Stavební dozor":"službu stavebního dozoru","Geodet":"službu geodeta","Autodoprava":"službu autodopravy","Fotovoltaika a solární panely":"službu fotovoltaiky a solárních panelů","Tepelná čerpadla":"službu tepelných čerpadel","Zabezpečení a kamerové systémy":"službu zabezpečení a kamerových systémů","Čištění kanalizace":"službu čištění kanalizace","Studny a čerpadla":"službu studní a čerpadel","Revize elektro a hromosvodů":"službu revizí elektro a hromosvodů"}
 function sync(){label.textContent=select.selectedOptions[0]?.textContent||'Vyberte typ opravy';items.forEach(i=>i.setAttribute('aria-selected',String(i.dataset.value===select.value)));if(locationHeading){const name=select.selectedOptions[0]?.textContent?.trim()||select.value;if(select.value){const serviceName=document.createElement('span');serviceName.className='selected-repair-name';serviceName.textContent=locationPhrases[name]||'službu „'+name+'“';locationHeading.replaceChildren(document.createTextNode('Kde potřebujete '),serviceName,document.createTextNode('?'))}else locationHeading.textContent='Kde potřebujete opravu?'}}
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
