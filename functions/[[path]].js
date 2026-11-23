// Cloudflare Pages Function: public contact and Access-protected admin APIs.
// Configure D1 and Cloudflare Access before using this beyond a preview.
const encoder=new TextEncoder();
const allowedSettings=['home_title','home_highlight','home_description','meta_description','google_description','seo_description','contact_email','facebook_url'];
let cachedKeys={team:'',until:0,keys:[]};
const now=()=>new Date().toISOString();
const tidy=(s,n)=>typeof s==='string'?s.trim().slice(0,n):'';
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const hash=async s=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
const b64url=s=>{let p=s.replace(/-/g,'+').replace(/_/g,'/');p+='='.repeat((4-p.length%4)%4);let v=atob(p);return Uint8Array.from(v,c=>c.charCodeAt(0))};
const json=(status,data,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const fail=(status,error)=>json(status,{error});
const first=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
const run=(db,sql,...args)=>db.prepare(sql).bind(...args).run();
const all=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
async function body(req,max=18000){const size=Number(req.headers.get('Content-Length')||0);if(size>max)throw new Error('Request is too large.');const reader=req.body?.getReader();let chunks=[],total=0;if(reader){while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();throw new Error('Request is too large.')}chunks.push(value)}}const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength}try{return JSON.parse(new TextDecoder().decode(bytes)||'{}')}catch{throw new Error('Invalid request.')}}
// Validate signature, issuer, audience, expiry and admin email on every private request.
async function accessIdentity(req,env){
 const team=String(env.CF_ACCESS_TEAM_DOMAIN||'').replace(/^https:\/\//,'').replace(/\/$/,''),aud=String(env.CF_ACCESS_AUD||''),email=String(env.ADMIN_EMAIL||'nafisfuad2412@gmail.com').toLowerCase();
 if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(team)||!aud||!email)return null;
 const token=req.headers.get('Cf-Access-Jwt-Assertion')||'';
 if(token.length>8192)return null;const parts=token.split('.');if(parts.length!==3)return null;
 try{
  const header=JSON.parse(new TextDecoder().decode(b64url(parts[0]))),payload=JSON.parse(new TextDecoder().decode(b64url(parts[1])));
  const seconds=Math.floor(Date.now()/1000),auds=Array.isArray(payload.aud)?payload.aud:[payload.aud];
  if(header.alg!=='RS256'||!header.kid||payload.iss!==`https://${team}`||!auds.includes(aud)||!Number.isFinite(payload.exp)||payload.exp<=seconds||(payload.nbf&&payload.nbf>seconds)||String(payload.email||'').toLowerCase()!==email)return null;
  if(cachedKeys.team!==team||cachedKeys.until<Date.now()){
   const r=await fetch(`https://${team}/cdn-cgi/access/certs`);if(!r.ok)return null;const jwks=await r.json();
   cachedKeys={team,until:Date.now()+300000,keys:Array.isArray(jwks.keys)?jwks.keys:[]};
  }
  const jwk=cachedKeys.keys.find(x=>x.kid===header.kid&&x.kty==='RSA');if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64url(parts[2]),encoder.encode(parts[0]+'.'+parts[1]));
  return valid?{email,csrf:await hash('nafis-csrf:'+token)}:null;
 }catch{return null}
}
async function notification(env,db,id,lead){
 if(!env.RESEND_API_KEY||!env.NAFIS_MAIL_FROM)return;
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.RESEND_API_KEY},body:JSON.stringify({from:env.NAFIS_MAIL_FROM,to:['nafisfuad2412@gmail.com'],subject:'New Nafis Digital inquiry',text:`Name: ${lead.name}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nService: ${lead.service}\n\n${lead.message}`})});
 await run(db,'UPDATE leads SET email_status=? WHERE id=?',r.ok?'accepted':`failed_http_${r.status}`,id)
 }catch{await run(db,'UPDATE leads SET email_status=? WHERE id=?','failed_network',id)}
}
async function audit(db,description){await run(db,'INSERT INTO activity(description,created) VALUES(?,?)',description,now())}
async function settings(db){return Object.fromEntries((await all(db,'SELECT key,value FROM settings')).map(x=>[x.key,x.value]))}
async function rateOK(db,req){
 const ip=req.headers.get('CF-Connecting-IP');if(!ip)return false;
 const window=Math.floor(Date.now()/600000),key=await hash(ip+':'+window),expires=(window+1)*600000;
 const row=await first(db,'INSERT INTO rate_limits(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count',key,expires);
 if(Math.random()<0.02)await run(db,'DELETE FROM rate_limits WHERE bucket IN (SELECT bucket FROM rate_limits WHERE expires<? LIMIT 100)',Date.now()-600000);
 return row&&row.count<=5;
}
export async function onRequest(context){
 const {request:req,env}=context,db=env.DB,u=new URL(req.url),p=u.pathname,m=req.method;
 try{
  if(!db)return fail(503,'Database is not configured. Complete the Cloudflare setup.');
  if(p.startsWith('/api/')&&m!=='GET'&&(req.headers.get('Origin')!==u.origin||!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'')))return fail(403,'Request origin rejected.');
  if(p==='/api/public'&&m==='GET')return json(200,{settings:await settings(db),cases:await all(db,'SELECT id,slug,category,title,summary,intro,strategy,note,image,published,position FROM cases WHERE published=1 ORDER BY position,id')});
  if(p==='/api/session'&&m==='GET'){const a=await accessIdentity(req,env);return json(200,{authenticated:!!a,csrf:a?.csrf||null,cloudflareAccessRequired:true})}
  if(p==='/api/contact'&&m==='POST'){
   if(!await rateOK(db,req))return fail(429,'Too many messages. Please try again later.');
   const b=await body(req);if(b.website)return json(200,{ok:true});
   const l={name:tidy(b.name,100),email:tidy(b.email,254),phone:tidy(b.phone,40),service:tidy(b.service,80),message:tidy(b.message,4000)};
   if(l.name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email)||!['Meta Ads','Google Ads','SEO','Other'].includes(l.service)||l.message.length<10)return fail(400,'Enter your name, a valid email, a service, and a message of at least 10 characters.');
   const result=await run(db,'INSERT INTO leads(name,email,phone,service,message,created) VALUES(?,?,?,?,?,?)',l.name,l.email,l.phone,l.service,l.message,now());
   try{await audit(db,'New inquiry received')}catch{console.error('Unable to record inquiry activity')};if(env.RESEND_API_KEY&&env.NAFIS_MAIL_FROM)context.waitUntil(notification(env,db,result.meta.last_row_id,l));return json(200,{ok:true});
  }
  if(p.startsWith('/api/admin/')){
   const a=await accessIdentity(req,env);if(!a)return fail(401,'Cloudflare Access authorization is required.');
   if(m!=='GET'&&req.headers.get('X-CSRF-Token')!==a.csrf)return fail(403,'Security token expired. Reload the page.');
   if(p==='/api/admin/dashboard'&&m==='GET'){
    const counts={leads:(await first(db,'SELECT count(*) n FROM leads')).n,new:(await first(db,"SELECT count(*) n FROM leads WHERE status='new'")).n,published:(await first(db,'SELECT count(*) n FROM cases WHERE published=1')).n};
    return json(200,{counts,leads:await all(db,'SELECT * FROM leads ORDER BY id DESC LIMIT 200'),cases:await all(db,'SELECT * FROM cases ORDER BY position,id'),settings:await settings(db),activity:await all(db,'SELECT description,created FROM activity ORDER BY id DESC LIMIT 15'),emailConfigured:!!(env.RESEND_API_KEY&&env.NAFIS_MAIL_FROM)});
   }
   if(p==='/api/admin/lead'&&m==='POST'){
    const b=await body(req);if(!Number.isInteger(b.id)||!['new','reviewed','contacted','closed'].includes(b.status)||typeof b.notes!=='string'||b.notes.length>4000)return fail(400,'Invalid lead details.');
    const r=await run(db,'UPDATE leads SET status=?,notes=? WHERE id=?',b.status,b.notes.trim(),b.id);if(!r.meta.changes)return fail(404,'Lead not found.');await audit(db,'Inquiry updated');return json(200,{ok:true});
   }
   if(p==='/api/admin/settings'&&m==='POST'){
    const b=await body(req);for(const k of allowedSettings)if(typeof b[k]!=='string'||!b[k].trim()||b[k].length>500)return fail(400,'Complete each field (maximum 500 characters).');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.contact_email))return fail(400,'Invalid email.');
    let link;try{link=new URL(b.facebook_url)}catch{return fail(400,'Invalid Facebook URL.')}
    if(link.protocol!=='https:'||!(link.hostname==='facebook.com'||link.hostname.endsWith('.facebook.com')))return fail(400,'Use an HTTPS Facebook URL.');
    await db.batch(allowedSettings.map(k=>db.prepare('UPDATE settings SET value=? WHERE key=?').bind(b[k].trim(),k)));await audit(db,'Website content updated');return json(200,{ok:true});
   }
   if(p==='/api/admin/case'&&m==='POST'){
    const b=await body(req),keys=['slug','category','title','summary','intro','strategy','note'];for(const k of keys)if(typeof b[k]!=='string'||b[k].trim().length>(['intro','strategy'].includes(k)?5000:600))return fail(400,'Invalid case study fields.');
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.slug)||!b.title.trim()||!b.category.trim()||!b.summary.trim())return fail(400,'Provide a lowercase slug, category, title and summary.');
    if(!/^(|\/uploads\/[a-f0-9]{32}\.(png|jpg|webp))$/.test(b.image||''))return fail(400,'Invalid image.');
    if(b.image&&!await first(db,'SELECT id FROM images WHERE id=?',b.image.slice(9)))return fail(400,'Image does not exist.');
    try{
     let r;if(b.id){if(!Number.isInteger(b.id))return fail(400,'Invalid case ID.');r=await run(db,'UPDATE cases SET slug=?,category=?,title=?,summary=?,intro=?,strategy=?,note=?,image=?,published=? WHERE id=?',...keys.map(k=>b[k].trim()),b.image||'',b.published?1:0,b.id);if(!r.meta.changes)return fail(404,'Case study not found.')}
     else r=await run(db,'INSERT INTO cases(slug,category,title,summary,intro,strategy,note,image,published,position) VALUES(?,?,?,?,?,?,?,?,?,99)',...keys.map(k=>b[k].trim()),b.image||'',b.published?1:0);
     await audit(db,b.id?'Case study updated':'Case study added');return json(200,{ok:true,id:b.id||r.meta.last_row_id});
    }catch(e){if(String(e.message).includes('UNIQUE'))return fail(400,'That page slug is already in use.');throw e}
   }
   if(p==='/api/admin/upload'&&m==='POST'){
    const b=await body(req,1400000);if(typeof b.data!=='string'||b.data.length>1200000||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.data))return fail(400,'Use an image smaller than 900 KB.');
    let raw;try{raw=atob(b.data)}catch{return fail(400,'Invalid image.')}
    if(raw.length>900000||raw.length<12)return fail(400,'Use an image smaller than 900 KB.');
    const png=raw.charCodeAt(0)===137&&raw.slice(1,4)==='PNG'&&raw.slice(4,8)==='\r\n\x1a\n',jpg=raw.charCodeAt(0)===255&&raw.charCodeAt(1)===216&&raw.charCodeAt(2)===255,webp=raw.slice(0,4)==='RIFF'&&raw.slice(8,12)==='WEBP';
    const ext=png?'png':jpg?'jpg':webp?'webp':null;if(!ext)return fail(400,'Use PNG, JPEG, or WebP.');const id=random()+'.'+ext;
    await run(db,'INSERT INTO images(id,mime,data,created) VALUES(?,?,?,?)',id,ext==='jpg'?'image/jpeg':'image/'+ext,b.data,now());return json(200,{url:'/uploads/'+id});
   }
   return fail(404,'Unknown admin action.');
  }
  if(p.startsWith('/uploads/')&&(m==='GET'||m==='HEAD')){
   const id=p.slice(9);if(!/^[a-f0-9]{32}\.(png|jpg|webp)$/.test(id))return fail(404,'Not found.');
   if(!await first(db,'SELECT 1 AS ok FROM cases WHERE image=? AND published=1',p)&&!await accessIdentity(req,env))return fail(404,'Not found.');
   const im=await first(db,'SELECT mime,data FROM images WHERE id=?',id);if(!im)return fail(404,'Not found.');
   const raw=atob(im.data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return new Response(m==='HEAD'?null:bytes,{headers:{'Content-Type':im.mime,'Content-Length':String(bytes.length),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  return fail(404,'Not found.');
 }catch(e){if(e.message==='Request is too large.')return fail(413,e.message);if(e.message==='Invalid request.')return fail(400,e.message);console.error('Request failed:',String(e.message).slice(0,200));return fail(503,'Service unavailable. Check the database and Cloudflare configuration.')}
}
