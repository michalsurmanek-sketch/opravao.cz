self.addEventListener('push',event=>{
 let data={};try{data=event.data.json()}catch{}
 event.waitUntil(self.registration.showNotification(data.title||'Opravao.cz',{body:data.body||'Nová událost v administraci.',icon:'/opravao-push-icon.png',badge:'/opravao-push-icon.png',tag:data.tag||'opravao',data:{url:data.url||'/admin.html'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL(event.notification.data?.url||'/admin.html',self.location.origin);
 if(target.origin!==self.location.origin||target.pathname!=='/admin.html')return;
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  const existing=windows.find(w=>new URL(w.url).pathname==='/admin.html');
  if(existing){await existing.navigate(target.href);return existing.focus();}
  return clients.openWindow(target.href);
 }));
});
