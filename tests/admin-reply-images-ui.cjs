const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const s=fs.readFileSync('assets/opravao-admin-5a4c8618e7ce.js','utf8');
const nodes=new Map();function $(q){if(!nodes.has(q))nodes.set(q,{value:'',textContent:'',hidden:false,disabled:false,files:[],addEventListener(){},removeAttribute(k){delete this[k]}});return nodes.get(q)}
let request,revoked=0;const handlers={};
const context=vm.createContext({$,URL:'https://test.invalid',globalThis:{URL:{createObjectURL:()=> 'blob:preview',revokeObjectURL:()=>revoked++}},document:{addEventListener:(type,fn)=>handlers[type]=fn},leads:[],esc:x=>x,when:x=>x,crypto:{randomUUID:()=> 'request-id'},msg(){},refresh:async()=>{},api:async(_,b)=>{request=b;return{}},FileReader:class {readAsDataURL(){this.result='data:image/png;base64,iVBORw0KGgo=';this.onload()}},Promise,Error,confirm:()=>true});
vm.runInContext(s.slice(s.indexOf('let replyImageFile='),s.indexOf('$("#exportLeads").onclick')),context);
(async()=>{
 $('#replyImage').files=[{name:'coupon.png',type:'image/png',size:2048}];$('#replyImage').onchange();assert.equal($('#replyImagePreview').hidden,false);assert.equal($('#replyImageThumb').src,'blob:preview');
 $('#replyMessage').value='Děkujeme';$('#replyLeadId').value='lead-id';await $('#replyForm').onsubmit({preventDefault(){}});assert.equal(request.attachments[0].filename,'coupon.png');assert.equal(request.attachments[0].content,'iVBORw0KGgo=');assert.equal($('#replyImage').disabled,false);
 $('#replyImageRemove').onclick();assert.equal($('#replyImagePreview').hidden,true);assert.equal(revoked,1);
 $('#replyImage').files=[{name:'bad.svg',type:'image/svg+xml',size:1024}];$('#replyImage').onchange();assert.match($('#replyNotice').textContent,/5 MB/);assert.equal($('#replyImagePreview').hidden,true);
 console.log('PASS: image selection, preview, encoded send payload, input unlock, remove/revoke and unsupported type rejection');
})().catch(e=>{console.error(e);process.exit(1)});
