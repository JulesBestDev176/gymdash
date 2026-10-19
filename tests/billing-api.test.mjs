import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proxyBilling} from '../lib/server/billing.ts';
const config={baseUrl:'https://backend.example',secret:'private-server-secret'};
const req=(method='GET',body)=>new Request('https://dash.example/api/billing/invoices?page=2&ignored=secret',{method,headers:{Authorization:'Bearer admin-jwt','Content-Type':'application/json',Cookie:'do-not-forward'},...(body?{body:JSON.stringify(body)}:{})});
test('billing proxy accepts only known routes and forwards JWT plus server secret, no cookies',async()=>{
const response=await proxyBilling(req(),['invoices'],config,async(url,options)=>{
assert.equal(url,'https://backend.example/api/v1/platform-billing/invoices?page=2');
assert.equal(options.headers.Authorization,'Bearer admin-jwt');assert.equal(options.headers['x-gymdash-secret'],'private-server-secret');assert.equal(options.headers.Cookie,undefined);assert.equal(options.redirect,'error');
return Response.json({success:true,data:{items:[],page:2,total:0}});
});
assert.equal(response.status,200);assert.equal((await response.json()).page,2);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
const never=()=>{throw Error('must not fetch');};
assert.equal((await proxyBilling(req(),['..','auth'],config,never)).status,404);
assert.equal((await proxyBilling(req('POST',{}),['settings'],config,never)).status,405);
assert.equal((await proxyBilling(new Request('http://local'),['overview'],config,never)).status,401);
assert.equal((await proxyBilling(req(),['overview'],{...config,secret:''},never)).status,503);
});
test('financial commands retain the exact idempotency body and are sent once',async()=>{
let sends=0;const body={gymId:'gym-one',months:3,paid:true,mode:'WAVE',idempotencyKey:'same-retry-key'};
const response=await proxyBilling(req('POST',body),['invoices'],config,async(url,options)=>{sends++;assert.deepEqual(JSON.parse(options.body),body);return Response.json({success:true,data:{id:'invoice-a'}},{status:201});});
assert.equal(response.status,201);assert.equal(sends,1);
});
test('PDF responses remain authenticated binary downloads with safe headers',async()=>{
const response=await proxyBilling(req(),['invoices','invoice-a','pdf'],config,async()=>new Response('%PDF-fixture',{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="GP-2026-000001.pdf"'}}));
assert.equal(response.headers.get('Content-Type'),'application/pdf');assert.match(response.headers.get('Content-Disposition'),/GP-2026-000001/);assert.equal(await response.text(),'%PDF-fixture');
});
test('unavailable backend errors are sanitized and conflict statuses remain useful',async()=>{
const conflict=await proxyBilling(req('POST',{}),['invoices'],config,async()=>Response.json({message:'Cette référence de commande a déjà été utilisée.'},{status:409}));assert.equal(conflict.status,409);
const failed=await proxyBilling(req(),['overview'],config,async()=>Response.json({message:'private-db-password'},{status:500}));assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/private-db-password/);
});
