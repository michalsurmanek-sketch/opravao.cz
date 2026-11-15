(()=>{
 const toggle=$("#inboxToggle"),panel=$("#inboxPanel"),list=$("#inboxList"),countEl=$("#inboxCount"),status=$("#inboxStatus");
 if(!toggle||!panel)return;
 const incomingItems=lead=>(Array.isArray(lead.communication)?lead.communication:[]).map((entry,index)=>({entry,key:String(entry.provider_id||entry.request_id||entry.created_at||entry.sent_at||"message")+":"+index})).filter(({entry})=>entry.type==="incoming"||["in","incoming","inbound"].includes(entry.direction));
 const unreadItems=lead=>{const seen=new Set(settings["inbox_read_"+lead.id]?.seen_ids||[]);return incomingItems(lead).filter(item=>!seen.has(item.key))};
 function close(){panel.hidden=true;toggle.setAttribute("aria-expanded","false")}
 function update(rows=leads){
  const archived=new Set(archivedLeadIds());
  const threads=session?rows.filter(lead=>!lead.archived_at&&!archived.has(lead.id)).map(lead=>({lead,items:unreadItems(lead)})).filter(x=>x.items.length):[];
  threads.sort((a,b)=>new Date(b.items.at(-1).entry.created_at||b.items.at(-1).entry.sent_at||0)-new Date(a.items.at(-1).entry.created_at||a.items.at(-1).entry.sent_at||0));
  const count=threads.reduce((sum,x)=>sum+x.items.length,0);
  countEl.textContent=count>99?"99+":String(count);countEl.hidden=!count;toggle.classList.toggle("has-unread",!!count);
  toggle.setAttribute("aria-label",count?"Nepřečtené zprávy: "+count:"Žádné nepřečtené zprávy");toggle.title=count?"Nepřečtené zprávy: "+count:"Žádné nepřečtené zprávy";
  status.textContent=count?"Nové zprávy: "+count+" · Konverzace: "+threads.length:"Nemáte žádné nepřečtené zprávy.";
  list.innerHTML=threads.map(({lead,items})=>{const last=items.at(-1).entry;return '<button type="button" class="inbox-entry" data-reply-lead="'+esc(lead.id)+'"><strong>'+esc(lead.name||lead.email||"Zákazník")+' · '+items.length+'</strong><small>'+esc(lead.place||"")+' · '+esc(when(last.created_at||last.sent_at))+'</small><p>'+esc(last.body||last.message||"")+'</p></button>'}).join("");
  if(!session)close();
 }
 toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute("aria-expanded",String(!panel.hidden));if(!panel.hidden){update();pollUnreadLeads()}};
 $("#inboxClose").onclick=close;
 document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!panel.hidden){event.stopImmediatePropagation();close();toggle.focus()}},true);
 document.addEventListener("click",async event=>{
  const button=event.target.closest("[data-reply-lead]");
  if(!button){if(!panel.hidden&&!panel.contains(event.target)&&!toggle.contains(event.target))close();return}
  const lead=leads.find(x=>x.id===button.dataset.replyLead);
  if(!lead||$("#replyModal").hidden)return;
  if(button.classList.contains("inbox-entry")){close();go("requests")}
  const items=unreadItems(lead);if(!items.length)return;
  try{const result=await api("",{action:"mark_reply_read",id:lead.id,seen_ids:items.map(x=>x.key)},"POST");settings[result.key]=result.value;update()}
  catch{if(!$("#replyModal").hidden)$("#replyNotice").textContent="Zprávy jsou zobrazené, ale přečtení se nepodařilo uložit. Upozornění zůstává aktivní."}
 });
 window.opravaoInbox={update};update();
})();
