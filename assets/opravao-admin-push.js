(()=>{
 const panel=document.createElement('div');panel.className='panel';panel.innerHTML='<h3>Upozornění na mobil</h3><p>Nové poptávky a registrace řemeslníků i při zavřeném webu. Zapnutí platí pro tento telefon nebo prohlížeč.</p><div class="actions"><button type="button" class="button" id="enablePush">Zapnout upozornění</button><button type="button" class="button alt" id="testPush">Poslat zkušební oznámení</button><button type="button" class="button alt" id="disablePush">Vypnout na tomto zařízení</button></div><p id="pushNotice" role="status"></p>';
 document.querySelector('#settings').prepend(panel);
 const notice=document.querySelector('#pushNotice');
 const supported='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
 const call=async body=>{await ensureSession();const r=await fetch(URL+'/functions/v1/opravao-push',{method:body?'POST':'GET',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();if(!r.ok)throw Error(j.error||'Uložení se nezdařilo.');return j;};
 const reg=()=>navigator.serviceWorker.register('/opravao-push-sw.js',{scope:'/'}).then(async r=>{if(r.active)return r;await new Promise((resolve,reject)=>{const worker=r.installing||r.waiting;if(!worker)return reject(Error('Oznámení se nepodařilo připravit.'));worker.addEventListener('statechange',()=>{if(worker.state==='activated')resolve();if(worker.state==='redundant')reject(Error('Oznámení se nepodařilo připravit.'));});});return r;});
 const keyBytes=key=>Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4)),c=>c.charCodeAt(0));
 async function action(fn){try{notice.textContent='Zpracovávám…';await fn();}catch(e){notice.textContent=e.message;} }
 document.querySelector('#enablePush').onclick=()=>action(async()=>{
  if(!supported)throw Error('Tento prohlížeč oznámení nepodporuje. Na Androidu otevřete administraci v Chromu; na iPhonu přidejte web na plochu.');
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Oznámení nejsou povolená. Povolte je v nastavení webu v prohlížeči.');
  const cfg=await call(),r=await reg();let sub=await r.pushManager.getSubscription();if(!sub)sub=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(cfg.publicKey)});
  await call({action:'subscribe',subscription:sub.toJSON()});notice.textContent='Zapnuto na tomto zařízení pro nové poptávky i registrace. Vyzkoušejte zkušební oznámení.';
 });
 document.querySelector('#testPush').onclick=()=>action(async()=>{if(!supported)throw Error('Prohlížeč oznámení nepodporuje.');const sub=await(await reg()).pushManager.getSubscription();if(!sub)throw Error('Nejprve zapněte upozornění.');const result=await call({action:'test',endpoint:sub.endpoint});if(!result.sent)throw Error('Zkušební oznámení nebylo odesláno. Zkuste upozornění vypnout a znovu zapnout.');notice.textContent='Zkušební oznámení předáno k doručení. Zkontrolujte telefon.';});
 document.querySelector('#disablePush').onclick=()=>action(async()=>{if(!supported)throw Error('Prohlížeč oznámení nepodporuje.');const sub=await(await reg()).pushManager.getSubscription();if(sub){await call({action:'unsubscribe',subscription:sub.toJSON()});await sub.unsubscribe();}notice.textContent='Upozornění na tomto zařízení jsou vypnutá.';});
 if(!supported)notice.textContent='Otevřete administraci v podporovaném mobilním prohlížeči.';
 // Resolve notification links only after authenticated dashboard data have loaded.
 const params=new URLSearchParams(location.search),id=params.get('push_id'),kind=params.get('push_kind');
 if(/^[-a-f0-9]{36}$/i.test(id||'')&&['lead','partner'].includes(kind)){
  const observer=new MutationObserver(()=>{
   const attr=kind==='lead'?'data-save-lead':'data-psave',button=document.querySelector('['+attr+'="'+id+'"]');
   if(!button||!document.querySelector('#login').classList.contains('hidden'))return;
   observer.disconnect();go(kind==='lead'?'requests':'partners');
   const row=document.querySelector('['+attr+'="'+id+'"]')?.closest('tr');if(row){row.style.outline='3px solid #ed7b28';row.scrollIntoView({block:'center',behavior:'smooth'});}
  });observer.observe(document.querySelector('main')||document.body,{subtree:true,childList:true});
 }
})();
