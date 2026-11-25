import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveClockTokenLimit} from '../clock-token-limit.js';
test('inherits named connection preset or live ST generation limit',()=>{
 const ctx={mainApi:'openai',chatCompletionSettings:{openai_max_tokens:4096},extensionSettings:{connectionManager:{profiles:[{id:'a',api:'custom',preset:'fast'},{id:'b',api:'text',preset:'local'},{id:'c',api:'custom'}]}},CONNECT_API_MAP:{custom:{selected:'openai'},text:{selected:'textgenerationwebui'}},getPresetManager:type=>({getCompletionPresetByName:()=>type==='openai'?{openai_max_tokens:8192}:{genamt:1024}})};
 assert.equal(resolveClockTokenLimit(ctx,'a',300),8192);
 assert.equal(resolveClockTokenLimit(ctx,'b',300),1024);
 assert.equal(resolveClockTokenLimit(ctx,'c',300),4096);
 assert.equal(resolveClockTokenLimit(ctx,'',300),4096);
 ctx.mainApi='textgenerationwebui';assert.equal(resolveClockTokenLimit(ctx,'',768),768);
 assert.throws(()=>resolveClockTokenLimit(ctx,'missing',300));
});
