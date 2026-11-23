import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('public'),files=fs.readdirSync(root).filter(x=>x.endsWith('.html'));
for(const file of files){
 const text=fs.readFileSync(path.join(root,file),'utf8');
 assert.match(text,/<meta name="viewport"/);
 for(const [,link] of text.matchAll(/(?:href|src)="([^"]+)"/g)){
  if(/^(#|https?:|mailto:|tel:)/.test(link))continue;
  const rel=link.split(/[?#]/)[0];if(!rel)continue;
  assert.ok(fs.existsSync(path.join(root,rel)),`${file}: missing ${rel}`);
 }
}
const admin=fs.readFileSync(path.join(root,'admin.html'),'utf8');
assert.match(admin,/Cloudflare Access/);assert.doesNotMatch(admin,/id="setup-form"|id="password-form"/);
const routes=JSON.parse(fs.readFileSync(path.join(root,'_routes.json'),'utf8'));
assert.deepEqual(routes.include,['/api/*','/uploads/*']);
const generic=fs.readFileSync(path.join(root,'case.html'),'utf8');
for(const name of ['personal-brand.html','curtain-showroom.html','website-services.html']){
 const text=fs.readFileSync(path.join(root,name),'utf8');
 assert.match(text,/Loading case study/);assert.doesNotMatch(text,/173,037 interactions/);
}
assert.match(generic,/public\.js/);
assert.ok(fs.statSync(path.join(root,'assets/video.mp4')).size<25*1024*1024);
console.log(`PASS: ${files.length} public pages, local assets, Pages routes, Access UI, unpublished case shells, and video size.`);
