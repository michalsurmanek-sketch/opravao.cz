
/* Desktop custom dropdown, mobile keeps native select. */
(()=>{
 const select=document.getElementById('type'),picker=document.getElementById('repair-type-picker');
 if(!select||!picker)return;
 const trigger=picker.querySelector('.repair-type-trigger'),label=document.getElementById('repair-type-label'),panel=document.getElementById('repair-type-options');
 const choices=[...select.options].filter(o=>o.value);
 choices.forEach(option=>{const item=document.createElement('button');item.type='button';item.className='repair-type-option';item.setAttribute('role','option');item.setAttribute('aria-selected','false');item.textContent=option.textContent;item.dataset.value=option.value;panel.append(item);item.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));close();trigger.focus();});});
 const items=[...panel.querySelectorAll('.repair-type-option')];
 function sync(){label.textContent=select.selectedOptions[0]?.textContent||'Vyberte typ opravy';items.forEach(i=>i.setAttribute('aria-selected',String(i.dataset.value===select.value)));}
 function close(){panel.hidden=true;trigger.setAttribute('aria-expanded','false');}
 function open(){panel.hidden=false;trigger.setAttribute('aria-expanded','true');const selected=items.find(i=>i.dataset.value===select.value);(selected||items[0])?.focus();}
 trigger.addEventListener('click',()=>panel.hidden?open():close());
 trigger.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();open();}});
 panel.addEventListener('keydown',e=>{const idx=items.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();close();trigger.focus();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();items[(idx+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}else if(e.key==='Home'){e.preventDefault();items[0]?.focus();}else if(e.key==='End'){e.preventDefault();items[items.length-1]?.focus();}else if(e.key==='Tab')close();});
 document.addEventListener('click',e=>{if(!picker.contains(e.target))close();});
 select.addEventListener('change',sync);select.addEventListener('invalid',()=>{if(matchMedia('(min-width:851px)').matches){trigger.focus();}});
 sync();
})();
