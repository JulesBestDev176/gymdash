import { chromium } from '../../.tmp/exercise-browser/node_modules/playwright/index.mjs';
import path from 'node:path';import assert from 'node:assert/strict';
const base=process.env.RELEASE_TEST_URL||'http://localhost:3017';
const old={id:'already-published',versionName:'1.0.15',versionCode:16,packageName:'com.gympass.gympass_sn',notes:'Existing release',sizeBytes:95_219_136,sha256:'a'.repeat(64),status:'PUBLISHED',createdAt:'2026-10-24T01:00:00Z',publishedAt:'2026-10-24T01:00:00Z',apkUrl:'/fixture.apk'};
const draft={...old,id:'new-fixture',versionName:'1.0.16',versionCode:17,status:'DRAFT',publishedAt:null,apkUrl:null};
const browser=await chromium.launch({headless:true,executablePath:path.resolve('../.tmp/exercise-browser/browsers/chromium-1248/chrome-win64/chrome.exe')});
try{
 const context=await browser.newContext();await context.addInitScript(()=>{localStorage.setItem('gymdash_token','fixture-token');localStorage.setItem('gymdash_user',JSON.stringify({id:'fixture-admin',role:'ADMIN'}));});
 const page=await context.newPage();page.setDefaultTimeout(90_000);let posts=0;let succeed=false;let uploaded=false;let release;
 const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/app-releases/**',async route=>{
  const r=route.request(),endpoint=new URL(r.url()).pathname.replace('/api/app-releases/','');
  if(endpoint==='access')return route.fulfill({json:{allowed:true}});
  if(endpoint==='latest')return route.fulfill({json:{release:old}});
  if(endpoint==='admin'&&r.method()==='GET')return route.fulfill({json:{items:uploaded?[draft,old]:[old],nextCursor:null}});
  assert.equal(endpoint,'admin');assert.equal(r.method(),'POST');posts++;
  if(!succeed){await gate;try{await route.abort();}catch{}return;}
  uploaded=true;await route.fulfill({status:201,json:draft});
 });
 await page.goto(base+'/app-releases');await page.getByRole('heading',{name:'Historique des versions'}).waitFor();
 await page.getByLabel('Fichier APK',{exact:true}).setInputFiles({name:'next.apk',mimeType:'application/vnd.android.package-archive',buffer:Buffer.from('fixture-only')});
 await page.getByRole('button',{name:'Importer le brouillon',exact:true}).click();
 await page.getByRole('button',{name:'Import en cours…',exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>sessionStorage.getItem('gymdash_apk_upload:fixture-admin')));
 const unloadPrevented=await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;});assert.equal(unloadPrevented,true);
 let unloadDialog=false;page.once('dialog',async d=>{unloadDialog=d.type()==='beforeunload';await d.accept();});
 await page.reload();release();await page.getByRole('status',{name:'Import non confirmé'}).waitFor();assert.equal(unloadDialog,true);assert.equal(posts,1);
 assert.match(await page.getByRole('status',{name:'Import non confirmé'}).innerText(),/next.apk/);
 await page.getByRole('button',{name:'Vérifier l’historique'}).click();await page.getByText('Page 1',{exact:true}).waitFor();assert.equal(posts,1);
 await page.getByRole('button',{name:'J’ai vérifié'}).click();assert.equal(await page.evaluate(()=>sessionStorage.getItem('gymdash_apk_upload:fixture-admin')),null);
 succeed=true;await page.getByLabel('Fichier APK',{exact:true}).setInputFiles({name:'next.apk',mimeType:'application/vnd.android.package-archive',buffer:Buffer.from('fixture-only')});
 await page.getByRole('button',{name:'Importer le brouillon',exact:true}).click();await page.getByText(/Brouillon 1.0.16 \(17\) créé/).waitFor();
 assert.equal(posts,2);assert.equal(await page.evaluate(()=>sessionStorage.getItem('gymdash_apk_upload:fixture-admin')),null);
 assert.equal(await page.getByRole('status',{name:'Import non confirmé'}).count(),0);
 console.log(JSON.stringify({passed:true,checks:['reload warning','account-scoped pending marker','reload recovers warning without resubmission','history check does not create a version','successful manual retry clears marker'],fixturePosts:posts}));
}finally{await browser.close();}
