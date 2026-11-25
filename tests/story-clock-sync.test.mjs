import test from 'node:test';
import assert from 'node:assert/strict';
import {clockPosts,decodeStoryClock,createStoryClockSync} from '../story-clock-sync.js';
test('RP prose and HTML metadata; skip system',()=>{
 const rows=clockPosts([{mes:'Сейчас 17:00'},{mes:'scene',extra:{extblocks:'<!-- HT date=1997-10-23 | time=18:00 -->'}},{mes:'system',is_system:true}],s=>s,()=>false);
 assert.equal(rows.length,2);assert.match(rows[1].text,/18:00/);
 assert.notEqual(rows[0].key,clockPosts([{mes:'Сейчас 19:00'}],s=>s,()=>false)[0].key);
});
test('validates model response; unknown parts',()=>{
 assert.equal(decodeStoryClock('{"date":"--02-29","time":null}').year,undefined);
 assert.equal(decodeStoryClock('{"date":null,"time":null}'),null);
 assert.throws(()=>decodeStoryClock('{"date":"1997-02-29","time":"18:00"}'));
});
test('one request per revision, manual refresh, never when closed',async()=>{
 let cache=null,rows=[{key:'a',text:'scene'}],open=true,calls=0;const owner={};
 const c=createStoryClockSync({snapshot:()=>({owner,rows,cache}),request:async()=>{calls++;return '{"date":null,"time":"18:00"}'},persist:(_,v)=>{cache=v},isOpen:()=>open,onStatus:()=>{}});
 assert.equal(await c.sync(),'updated');assert.equal(await c.sync(),'cached');assert.equal(calls,1);
 open=false;assert.equal(await c.sync({force:true}),'closed');open=true;
 assert.equal(await c.sync({force:true}),'updated');rows=[{key:'b',text:'edited'}];assert.equal(await c.sync(),'updated');assert.equal(calls,3);
});
test('late results after chat change cannot save',async()=>{
 let owner={},resolve,save=0;const c=createStoryClockSync({snapshot:()=>({owner,rows:[{key:'a',text:'scene'}],cache:null}),request:()=>new Promise(r=>resolve=r),persist:()=>save++,isOpen:()=>true,onStatus:()=>{}});
 const p=c.sync();assert.equal(await c.sync(),'busy');owner={};resolve('{"date":null,"time":"18:00"}');assert.equal(await p,'changed');assert.equal(save,0);
});
