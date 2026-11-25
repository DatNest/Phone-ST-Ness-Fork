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

test('compact model output, optional JSON, empty and incomplete answers',()=>{
 assert.equal(decodeStoryClock('1997-10-23 | 17:30').hours,17);
 assert.equal(decodeStoryClock('--10-23 | 7:05').hours,7);
 assert.equal(decodeStoryClock('? | ?'),null);
 assert.equal(decodeStoryClock(' ```text\n1997-10-23 | ?\n``` ').day,23);
 assert.throws(()=>decodeStoryClock(''),/пустой ответ/);
 assert.throws(()=>decodeStoryClock('{"date":'),/неполный/);
 assert.throws(()=>decodeStoryClock('1997-10-23 | 24:00'));
 assert.throws(()=>decodeStoryClock('1997-02-29 | 18:00'));
});

test('long HUD post: scene data survives clipping, unrelated HUD history is excluded',()=>{
 const hud='[HUD]\n```json\n'+JSON.stringify({sc:{T:'17:22 | ранний вечер',Dt:'среда, 03.09.2025'},me:{lg:['10:00 - старое событие']},padding:'x'.repeat(7800)})+'\n```\n[/HUD]';
 const rows=clockPosts([{mes:'а'.repeat(2536)+hud}],s=>s,()=>false);
 assert.equal(rows[0].hud.hours,17);assert.equal(rows[0].hud.minutes,22);
 assert.equal(rows[0].hud.year,2025);assert.equal(rows[0].hud.month,9);assert.equal(rows[0].hud.day,3);
 assert.match(rows[0].text,/17:22/);assert.match(rows[0].text,/03\.09\.2025/);
 assert.doesNotMatch(rows[0].text,/старое событие/);
});
test('complete latest HUD needs no API, old null cache is ignored, later prose uses AI',async()=>{
 const rows=clockPosts([{mes:'[HUD]\n```json\n{"sc":{"T":"17:22 | ранний вечер","Dt":"среда, 03.09.2025"}}\n```\n[/HUD]'}],s=>s,()=>false);
 const owner={};let cache={keys:rows.map(r=>r.key),value:null},calls=0;
 const c=createStoryClockSync({snapshot:()=>({owner,rows,cache}),request:async()=>{calls++;return '? | ?'},persist:(_,v)=>{cache=v},isOpen:()=>true,onStatus:()=>{}});
 assert.equal(await c.sync(),'updated');assert.equal(cache.value.source,'rp-hud');assert.equal(calls,0);
 assert.equal(await c.sync(),'cached');assert.equal(await c.sync({force:true}),'updated');assert.equal(calls,0);
 rows.push({key:'later',text:'следующий пост'});
 assert.equal(await c.sync(),'updated');assert.equal(calls,1);assert.equal(cache.value.source,'rp-hud-last');
});
