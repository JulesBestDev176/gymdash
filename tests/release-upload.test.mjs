import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readUploadAttempt, uploadMessage, saveUploadAttempt, clearUploadAttempt } from '../lib/release-upload.ts';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('an unfinished upload survives page reload but remains scoped to its account',()=>{
 const s=storage();const attempt={name:'gympass.apk',size:95_000_000,startedAt:1000};
 saveUploadAttempt(s,'admin-1',attempt);
 assert.deepEqual(readUploadAttempt(s,'admin-1'),attempt);
 assert.equal(readUploadAttempt(s,'admin-2'),null);
 clearUploadAttempt(s,'admin-1');assert.equal(readUploadAttempt(s,'admin-1'),null);
});
test('storage failure or malformed persisted data cannot break the release page',()=>{
 const s={getItem(){throw Error('blocked')},setItem(){throw Error('full')},removeItem(){throw Error('blocked')}};
 assert.equal(readUploadAttempt(s,'admin'),null);assert.doesNotThrow(()=>saveUploadAttempt(s,'admin',{name:'x.apk',size:1,startedAt:1}));assert.doesNotThrow(()=>clearUploadAttempt(s,'admin'));
 const local=storage();
 for(const value of ['{broken',JSON.stringify({name:'x.apk',size:1,startedAt:9e15}),JSON.stringify({name:'x.apk',size:-1,startedAt:1})]){
  local.setItem('gymdash_apk_upload:admin',value);assert.equal(readUploadAttempt(local,'admin'),null);
 }
});
test('upload progress distinguishes slow transfer from server-side analysis',()=>{
 assert.match(uploadMessage(88,17),/Transfert : 88/i);
 assert.match(uploadMessage(88,17),/progression|octet|réseau/i);
 assert.match(uploadMessage(100,17),/Analyse|enregistrement/);
 assert.doesNotMatch(uploadMessage(100,17),/88/);
});
