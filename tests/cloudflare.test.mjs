import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/[[path]].js';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
class Statement{
 constructor(sql,args=[]){this.sql=sql;this.args=args}
 bind(...args){return new Statement(this.sql,args)}
 async first(){return sqlite.prepare(this.sql).get(...this.args)||null}
 async all(){return {results:sqlite.prepare(this.sql).all(...this.args)}}
 async run(){const r=sqlite.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}
}
const DB={prepare:sql=>new Statement(sql),batch:async statements=>Promise.all(statements.map(s=>s.run()))};
const team='test-team.cloudflareaccess.com',aud='sample-audience-for-test',email='nafisfuad2412@gmail.com';
const env={DB,CF_ACCESS_TEAM_DOMAIN:team,CF_ACCESS_AUD:aud,ADMIN_EMAIL:email};
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{if(String(url)===`https://${team}/cdn-cgi/access/certs`)return Response.json({keys:[jwk]});throw Error('Unexpected outbound request')};
const to64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
async function token(overrides={},key=keys.privateKey){const h=to64({alg:'RS256',kid:'test-key',typ:'JWT'}),p=to64({iss:`https://${team}`,aud:[aud],exp:Math.floor(Date.now()/1000)+600,email,...overrides});const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(h+'.'+p));return h+'.'+p+'.'+Buffer.from(sig).toString('base64url')}
let jwt=await token(),csrf='';
async function call(path,method='GET',payload,options={}){
 const headers={'CF-Connecting-IP':options.ip||'203.0.113.5'};if(options.jwt!==false)headers['Cf-Access-Jwt-Assertion']=options.jwt||jwt;
 if(method!=='GET'&&method!=='HEAD'){headers['Content-Type']='application/json';headers.Origin=options.origin||'https://nafis.example';if(options.csrf!==false&&csrf)headers['X-CSRF-Token']=csrf}
 const req=new Request('https://nafis.example'+path,{method,headers,body:method==='GET'||method==='HEAD'?undefined:JSON.stringify(payload||{})});
 const waits=[];const r=await onRequest({request:req,env:options.env||env,waitUntil:p=>waits.push(p)});await Promise.all(waits);
 const t=r.headers.get('Content-Type')||'';return {status:r.status,body:t.includes('json')?await r.json():await r.arrayBuffer()};
}
try{
 assert.equal((await call('/api/public')).body.cases.length,3);
 assert.equal((await call('/api/admin/dashboard','GET',null,{jwt:false})).status,401);
 assert.equal((await call('/api/admin/dashboard','GET',null,{jwt:await token({email:'other@example.com'})})).status,401);
 assert.equal((await call('/api/admin/dashboard','GET',null,{jwt:await token({exp:1})})).status,401);
 assert.equal((await call('/api/admin/dashboard','GET',null,{jwt:await token({aud:['wrong-audience']})})).status,401);
 const attacker=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 assert.equal((await call('/api/admin/dashboard','GET',null,{jwt:await token({},attacker.privateKey)})).status,401);
 assert.equal((await call('/api/session','GET',null,{jwt:false})).body.authenticated,false);
 const sess=await call('/api/session');assert.equal(sess.body.authenticated,true);csrf=sess.body.csrf;
 assert.equal((await call('/api/contact','POST',{}, {origin:'https://evil.example'})).status,403);
 assert.equal((await call('/api/contact','POST',{}, {ip:'203.0.113.6'})).status,400);
 let r=await call('/api/contact','POST',{name:'Test Visitor',email:'test@example.com',phone:'',service:'SEO',message:'This is a test inquiry only.'});assert.equal(r.status,200);
 let dash=await call('/api/admin/dashboard');assert.equal(dash.status,200);assert.equal(dash.body.counts.leads,1);assert.equal(dash.body.leads[0].email_status,'not_configured');
 assert.equal((await call('/api/admin/lead','POST',{id:1,status:'reviewed',notes:'Test note'},{csrf:false})).status,403);
 assert.equal((await call('/api/admin/lead','POST',{id:1,status:'reviewed',notes:'Test note'})).status,200);
 dash=await call('/api/admin/dashboard');assert.equal(dash.body.leads[0].notes,'Test note');
 let config=dash.body.settings;config.home_title='Edited heading';assert.equal((await call('/api/admin/settings','POST',config)).status,200);assert.equal((await call('/api/public')).body.settings.home_title,'Edited heading');
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
 let upload=await call('/api/admin/upload','POST',{data:png});assert.equal(upload.status,200);assert.equal((await call(upload.body.url,'GET',null,{jwt:false})).status,404);
 let c={slug:'example-case',category:'Example',title:'Example case',summary:'Example result',intro:'Intro',strategy:'Strategy',note:'Context',image:upload.body.url,published:true};
 let created=await call('/api/admin/case','POST',c);assert.equal(created.status,200);assert.equal((await call(upload.body.url,'GET',null,{jwt:false})).status,200);
 c.id=created.body.id;c.published=false;assert.equal((await call('/api/admin/case','POST',c)).status,200);assert.equal((await call(upload.body.url,'GET',null,{jwt:false})).status,404);
 assert.equal((await call('/api/admin/dashboard','GET',null,{env:{DB}})).status,401);
 assert.equal((await call('/api/public','GET',null,{env:{}})).status,503);
 console.log('PASS: D1 schema, public content, contact, origin and CSRF checks, signed Access tokens, unauthorized access, lead editing, content editing, image upload and case publishing.');
}catch(e){console.error('FAIL:',e);process.exitCode=1}finally{globalThis.fetch=originalFetch;sqlite.close()}
