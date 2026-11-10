(()=>{
  const form=document.getElementById('company-form');
  if(!form)return;
  const requested=new URLSearchParams(window.location.search).get('obor');
  if(!requested)return;
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLocaleLowerCase('cs');
  const options=[...form.querySelectorAll('[name="specialization_option"]')];
  const input=options.find(item=>item.value===requested)||options.find(item=>normalize(item.value)===normalize(requested));
  if(!input)return;
  const apply=()=>{
    input.checked=true;
    input.closest('.specialization-choice')?.classList.add('prefilled-specialization');
    input.dispatchEvent(new Event('change',{bubbles:true}));
    const message=document.getElementById('specialization-prefill');
    if(message){
      message.textContent='Předvybraný obor: '+input.value+'. Je už zaškrtnutý; můžete označit i další obory.';
      message.dataset.state='selected';
      message.hidden=false;
    }
  };
  apply();
  window.addEventListener('pageshow',apply);
})();
