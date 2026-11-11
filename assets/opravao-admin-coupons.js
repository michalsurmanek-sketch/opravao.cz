(()=>{"use strict";
const URL="https://jmukoccjqykyoqsypuwb.supabase.co",KEY="sb_publishable_FSrTbgu1LeF9DNeam3ztwA_3dNHGq-V",FN=URL+"/functions/v1/opravao-admin";
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=s=>s?new Date(s+"T00:00:00").toLocaleDateString("cs-CZ"):"Bez omezení",fmtTime=s=>s?new Date(s).toLocaleString("cs-CZ"):"—";
async function request(resource,body=null){
 let session;try{session=JSON.parse(sessionStorage.getItem("opravao_admin_session")||"null")}catch{}
 if(!session?.access_token)throw Error("Přihlášení vypršelo. Přihlaste se prosím znovu.");
 if(session.refresh_token&&Number(session.expires_at||0)<Math.floor(Date.now()/1000)+60){
  const refreshed=await fetch(URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});
  const next=await refreshed.json().catch(()=>({}));if(!refreshed.ok)throw Error("Přihlášení vypršelo. Přihlaste se znovu.");
  session={...next,expires_at:Math.floor(Date.now()/1000)+Number(next.expires_in||3600)};sessionStorage.setItem("opravao_admin_session",JSON.stringify(session));
 }
 const opts=body?{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify(body)}:{headers:{apikey:KEY,Authorization:"Bearer "+session.access_token}};
 const res=await fetch(FN+(body?"":"?resource="+encodeURIComponent(resource)),opts),data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error==="admin_forbidden"?"Účet nemá oprávnění správce.":data.error==="resend_not_configured"?"Odesílání e-mailů není nastaveno.":data.error==="coupon_outside_validity"?"Kupón je mimo nastavenou dobu platnosti.":data.error==="coupon_has_history"?"Kupón má historii rozesílky a nelze jej trvale vymazat.":data.detail||data.error||"Požadavek se nezdařil.");
 return data;
}
function notice(id,msg,bad=false){const el=$(id);if(el){el.textContent=msg;el.classList.toggle("error",bad)}}
function couponRow(c,counts){return '<tr><td><strong>'+esc(c.title)+'</strong><br><small>'+esc(c.provider_name||"")+'</small></td><td><strong>'+esc(c.code)+'</strong><br>'+esc(c.discount_percent)+' %</td><td>'+esc(c.region)+'<br><small>'+esc(c.repair_type||"Všechny služby")+'</small></td><td>'+esc(fmt(c.valid_from))+(c.valid_until?" – "+esc(fmt(c.valid_until)):"")+'</td><td><span class="status">'+esc(({draft:"Koncept",active:"Aktivní",paused:"Pozastavený",expired:"Vypršel"})[c.status]||c.status)+'</span></td><td>'+Number(counts[c.id]||0)+'</td><td><div class="actions"><button class="button coupon-send" data-id="'+esc(c.id)+'" data-title="'+esc(c.title)+'">'+(c.status==="active"?"Poslat dalším":"Zkontrolovat a odeslat")+'</button><button type="button" class="opravao-trash coupon-archive" data-id="'+esc(c.id)+'" data-title="'+esc(c.title)+'" title="Přesunout kupón do koše" aria-label="Přesunout kupón do koše"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v7m4-7v7"/></svg></button></div></td></tr>'}
async function load(){
 try{const data=await request("coupons");const counts=data.sent_counts||{};const rows=$("#couponRows");if(!rows)return;
  rows.innerHTML=(data.data||[]).map(c=>couponRow(c,counts)).join("")||'<tr><td colspan="7" class="empty">Zatím nejsou vytvořené žádné kupóny.</td></tr>';
  const trash=data.archived||[];$("#couponTrashCount").textContent=String(trash.length);
  $("#couponTrashRows").innerHTML=trash.map(c=>'<tr><td><strong>'+esc(c.title)+'</strong><br><small>'+esc(c.provider_name||"")+'</small></td><td><strong>'+esc(c.code)+'</strong><br>'+esc(c.discount_percent)+' %</td><td>'+esc(c.region)+'</td><td>'+esc(fmtTime(c.archived_at))+'</td><td><div class="actions"><button type="button" class="button alt coupon-restore" data-id="'+esc(c.id)+'">Obnovit</button><button type="button" class="button dark coupon-delete" data-id="'+esc(c.id)+'" data-title="'+esc(c.title)+'">Trvale vymazat</button></div></td></tr>').join("")||'<tr><td colspan="5" class="empty">Koš kupónů je prázdný.</td></tr>';
  rows.querySelectorAll(".coupon-send").forEach(btn=>btn.addEventListener("click",()=>send(btn)));
  rows.querySelectorAll(".coupon-archive").forEach(btn=>btn.addEventListener("click",()=>archive(btn)));
  $("#couponTrashRows").querySelectorAll(".coupon-restore").forEach(btn=>btn.addEventListener("click",()=>changeArchive(btn,"restore_coupon")));
  $("#couponTrashRows").querySelectorAll(".coupon-delete").forEach(btn=>btn.addEventListener("click",()=>deleteCoupon(btn)));
  notice("#couponListNotice","");
 }catch(e){notice("#couponListNotice",e.message,true)}
}
async function send(btn){
 btn.disabled=true;const id=btn.dataset.id;
 try{
  const preview=await request("",{action:"preview_coupon",id});
  if(!preview.eligible){notice("#couponListNotice","Pro tuto nabídku zatím není žádný nový příjemce se souhlasem. Kupón se neodeslal.");return}
  if(!window.confirm("Kupón „"+btn.dataset.title+"“ odpovídá "+preview.eligible+" příjemcům z kraje "+preview.region+". Odeslat jim e-mail nyní?"))return;
  const result=await request("",{action:"send_coupon",id});
  notice("#couponListNotice","Rozesláno: "+result.sent+" e-mailů. Neodesláno: "+result.failed+". Celkem odpovídalo "+result.eligible+" příjemců.");
  await load();
 }catch(e){notice("#couponListNotice",e.message,true)}finally{btn.disabled=false}
}
async function archive(btn){
 if(!confirm("Přesunout kupón „"+btn.dataset.title+"“ do koše? Další rozesílání se zastaví."))return;
 btn.disabled=true;try{await request("",{action:"archive_coupon",id:btn.dataset.id});notice("#couponListNotice","Kupón byl přesunut do koše.");await load()}catch(e){notice("#couponListNotice","Přesun do koše selhal: "+e.message,true)}finally{btn.disabled=false}
}
async function changeArchive(btn,action){
 btn.disabled=true;try{await request("",{action,id:btn.dataset.id});notice("#couponListNotice",action==="restore_coupon"?"Kupón byl obnoven.":"");await load()}catch(e){notice("#couponListNotice",e.message,true)}finally{btn.disabled=false}
}
async function deleteCoupon(btn){
 if(!confirm("Kupón „"+btn.dataset.title+"“ trvale vymazat? Tuto akci nelze vrátit."))return;
 btn.disabled=true;try{await request("",{action:"delete_coupon",id:btn.dataset.id});notice("#couponListNotice","Kupón byl trvale vymazán.");await load()}catch(e){notice("#couponListNotice","Trvalé vymazání selhalo: "+e.message,true)}finally{btn.disabled=false}
}
$("#toggleCouponTrash")?.addEventListener("click",()=>{const panel=$("#couponTrashPanel"),button=$("#toggleCouponTrash");panel.hidden=!panel.hidden;button.setAttribute("aria-expanded",String(!panel.hidden));if(!panel.hidden)panel.scrollIntoView({behavior:"smooth",block:"nearest"})});
const form=$("#couponForm");
form?.addEventListener("submit",async e=>{
 e.preventDefault();if(!form.reportValidity())return;
 const button=form.querySelector('button[type="submit"]');button.disabled=true;notice("#couponNotice","Ukládám koncept…");
 const d=new FormData(form),coupon=Object.fromEntries(d.entries());coupon.discount_percent=Number(coupon.discount_percent);coupon.code=String(coupon.code||"").toUpperCase();
 try{await request("",{action:"create_coupon",coupon});form.reset();$("#couponDiscount").value="10";notice("#couponNotice","Koncept uložen. Zkontrolujte počet příjemců před odesláním.");await load()}
 catch(err){notice("#couponNotice",err.message,true)}finally{button.disabled=false}
});
document.querySelectorAll('.nav button[data-view="coupons"]').forEach(btn=>btn.addEventListener("click",()=>setTimeout(load,20)));
})();