const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('supabase/functions/opravao-inbound-email/thread-match.ts','utf8').replace('export async function','async function');
let rows=[],providerCalls=0;const context=vm.createContext({URLSearchParams,Set,Array,String,Error,AbortSignal,fetch:async(url)=>{
 if(url.startsWith('https://api.resend.com')){providerCalls++;return Response.json({message_id:'<delayed@example.invalid>'})}
 return Response.json(rows);
}});vm.runInContext(source,context);
async function match(parsed){return context.findReplyLead({from:{address:'Customer@example.invalid'},...parsed},'https://db.invalid','key','resend')}
(async()=>{
 rows=[{id:'correct',email:'customer@example.invalid',communication:[{type:'outgoing',message_id:'<sent@example.invalid>'}]},{id:'other',email:'customer@example.invalid',communication:[]}];
 assert.equal(await match({inReplyTo:'<sent@example.invalid>'}),'correct');
 assert.equal(await match({references:'<old@example.invalid> <sent@example.invalid>'}),'correct');
 assert.equal(await match({}),null);assert.equal(await match({inReplyTo:'<unknown@example.invalid>'}),null);
 rows[0].email='attacker@example.invalid';assert.equal(await match({inReplyTo:'<sent@example.invalid>'}),null);
 rows=[{id:'correct',email:'customer@example.invalid',communication:[{type:'incoming',provider_id:'<customer-reply@example.invalid>'}]}];
 assert.equal(await match({inReplyTo:'<customer-reply@example.invalid>'}),'correct');
 rows=[{id:'delayed',email:'customer@example.invalid',communication:[{type:'outgoing',provider_id:'11111111-1111-4111-8111-111111111111'}]}];
 assert.equal(await match({inReplyTo:'<delayed@example.invalid>'}),'delayed');assert.equal(providerCalls,1);
 rows=[{id:'one',email:'customer@example.invalid',communication:[{message_id:'<same@example.invalid>'}]},{id:'two',email:'customer@example.invalid',communication:[{message_id:'<same@example.invalid>'}]}];assert.equal(await match({inReplyTo:'<same@example.invalid>'}),null);
 console.log('PASS: reply headers, reference chain, repeated replies, sender verification, no guessing, ambiguous matches and delayed Message-ID recovery');
})().catch(e=>{console.error(e);process.exit(1)});
