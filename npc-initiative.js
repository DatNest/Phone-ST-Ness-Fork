// NPC initiative is phone-only activity. It never creates RP posts or injects
// instructions into the narrator. Every decision is made from *new* RP replies,
// the established phone book and the current AU, including indirect cues.
import {
    getSettings, getMeta, saveMeta, getThreadList, getRpDateTime,
    isSmsBlocked, isUserName, resolveContactKey, invalidateChatCache,
    isPhoneAppInstalled, phoneActivityAllowed,
} from './state.js';
import { privateRoleplayText } from './private-context.js';
import { generateNpcInitiativeDecision, generateNpcInitiativeMessage, logSocialToChat } from './social.js';
import { registerIncomingPhoneCall } from './calls.js';
import { eligibleInitiativeContact, selectNpcDecision, npcMessagesSimilar } from './npc-initiative-core.js';

const inProgress=new WeakSet();
function RP(){return SillyTavern.getContext()?.chat||[];}
function hash(s){let h=2166136261;for(const c of String(s||''))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36);}
function latestRpReply() {
    const chat=RP();
    // Only a completed assistant RP answer is a trigger; phone-generated ghost
    // SMS, journals, user messages, system rows are not turns of the story.
    const index=chat.length-1, m=chat[index];
    if(!m || m.is_user || m.is_system) return null;
    const rp=privateRoleplayText(m).trim();
    if(!rp || /^<!--\s*tel:/i.test(rp) || /^\[(?:SMS|СМС|Voice|Голосовое)/i.test(rp))return null;
    const signature=`${index}:${String(m.send_date||m.extra?.gen_id||'')}:${hash(rp)}`;
    return {index, message:m,signature};
}
function tracker(){
    const meta=getMeta();
    if(!meta.npcInitiative || typeof meta.npcInitiative!=='object' || Array.isArray(meta.npcInitiative))
        meta.npcInitiative={lastSignature:'',smsTurns:0,callTurns:0,messages:[],seq:0};
    const state=meta.npcInitiative;
    if(!Array.isArray(state.messages))state.messages=[];
    if(!Number.isInteger(state.seq))state.seq=0;
    return state;
}
// First installation and chat changes establish a baseline: never generate
// a flood of "missed" initiative from hundreds of old RP messages.
export function initializeNpcInitiative(){
    const current=latestRpReply();if(!current)return;
    const state=tracker();
    if(!state.lastSignature){state.lastSignature=current.signature;saveMeta();}
}
function availableContacts(kind) {
    const meta=getMeta();
    const listing=new Set((meta.contacts||[]).filter(c=>c.publicListing).map(c=>resolveContactKey(c.name)));
    return getThreadList()
        .filter(c=>eligibleInitiativeContact(c,{isBlocked:isSmsBlocked,isPublic:k=>listing.has(k)}))
        .filter(c=>!isUserName(c.originalName||c.name))
        .filter(c=>isPhoneAppInstalled(kind==='call'?'phone':'list'))
        .slice(0,45);
}
function storyContext(index){
    const chat=RP();
    return chat.slice(Math.max(0,index-13),index+1)
        .filter(m=>m&&!m.is_system)
        .map(m=>({speaker:m.is_user?'PLAYER':(m.name||'NPC'),text:privateRoleplayText(m).replace(/<!--[\s\S]*?-->/g,'').trim().slice(-1300)}))
        .filter(x=>x.text).slice(-12)
        .map(x=>`${x.speaker}: ${x.text}`).join('\n');
}
function storyTime(){
    const dt=getRpDateTime();if(!dt)return '';
    return [dt?.year?`${dt.day}.${dt.month}.${dt.year}`:'',
        Number.isInteger(dt?.hours)?`${String(dt.hours).padStart(2,'0')}:${String(dt.minutes).padStart(2,'0')}`:'']
        .filter(Boolean).join(' ');
}
export async function handleNpcInitiativeTurn(api={}) {
    const settings=getSettings();
    if(!settings.isEnabled||!settings.npcInitiativeEnabled||settings.quietMode)return;
    const current=latestRpReply();if(!current)return;
    const meta=getMeta(),state=tracker();
    if(!state.lastSignature){state.lastSignature=current.signature;saveMeta();return;}
    if(current.signature===state.lastSignature || inProgress.has(meta))return;
    // Persist the trigger before any asynchronous model call. A second event
    // for the same assistant response cannot initiate two requests.
    state.lastSignature=current.signature;
    state.smsTurns=(Number(state.smsTurns)||0)+1;
    state.callTurns=(Number(state.callTurns)||0)+1;
    const smsThreshold=Math.min(100,Math.max(1,Number(settings.npcSmsEvery)||3));
    const callThreshold=Math.min(100,Math.max(1,Number(settings.npcCallEvery)||12));
    const dueSms=state.smsTurns>=smsThreshold;
    const dueCall=state.callTurns>=callThreshold;
    if(!dueSms&&!dueCall){saveMeta();return;}
    // Separate intervals, at most one initiative event per RP reply.
    // A due call takes the slot; due SMS is tried on the next eligible turn.
    const kind=dueCall?'call':'sms';
    if(kind==='call')state.callTurns=0;else state.smsTurns=0;
    saveMeta();
    const contacts=availableContacts(kind);
    if(!contacts.length)return;
    // An ensemble candidate list must not disclose everyone's PRIVATE SMS
    // history to a model choosing a single sender. Only known identities.
    const promptContacts=contacts.map(c=>({key:c.key,name:c.originalName||c.name}));
    const activityVersion=getSettings().phoneActivityVersion;
    const expected=current.message;
    inProgress.add(meta);
    try{
        const raw=await generateNpcInitiativeDecision({kind,contacts:promptContacts,
            story:storyContext(current.index),storyTime:storyTime()});
        if(getMeta()!==meta || !phoneActivityAllowed(activityVersion) ||
           !settings.npcInitiativeEnabled || RP()[current.index]!==expected)return;
        const selection=selectNpcDecision(raw,kind,contacts);
        if(!selection || selection.kind==='none')return;
        const contact=availableContacts(kind).find(c=>c.key===selection.contact.key);
        if(!contact)return;
        if(kind==='call'){
            const call=registerIncomingPhoneCall(contact,selection.reason);
            if(call){
                api.notifyIncomingCall?.(call);api.updateFabBadge?.();if(api.isPhoneOpen?.())api.render?.();
                // The RP can learn that a call has arrived when its existing
                // private phone journal is enabled. Do not assume it was answered.
                void logSocialToChat(`На телефоне игрока входящий звонок от ${contact.name}. Звонок ещё не принят. Причина: ${selection.reason}. Это приватное событие, не городская новость.`,
                    {priv:true,marker:`npc-call:${call.id}`});
            }
            return;
        }
        // Keep phone-generated SMS in chat-specific phone metadata; do not
        // manufacture a user's RP turn or inject a tel:sms ghost message.
        const fresh=getThreadList().find(c=>c.key===contact.key);
        const existing=(fresh?.messages||[]).filter(m=>m.dir==='in').slice(-8);
        // The second request sees ONLY this sender's own conversation. A cast-wide
        // decision never exposes SMS belonging to other private contacts.
        let text=selection.text;
        try {
            const revised=await generateNpcInitiativeMessage({
                contact:{key:contact.key,name:contact.originalName||contact.name},
                reason:selection.reason,story:storyContext(current.index),storyTime:storyTime(),
                ownMessages:(fresh?.messages||[]).slice(-10)
                    .map(m=>({from:m.dir==='in'?'NPC':'PLAYER',text:String(m.text||'').slice(0,600)})),
            });
            if(revised) text=revised;
        } catch(e) {
            if(e?.name==='AbortError')return;
            console.warn('[GlassPhone] NPC initiative message refinement unavailable:',e);
        }
        if(getMeta()!==meta || !phoneActivityAllowed(activityVersion) ||
           !settings.npcInitiativeEnabled || RP()[current.index]!==expected)return;
        if(existing.some(m=>Math.abs(current.index-(m.idx??0))<=8 && npcMessagesSimilar(m.text,text)))return;
        if(state.messages.some(m=>m.contactKey===contact.key&&Math.abs(current.index-(m.idx??0))<=8&&npcMessagesSimilar(m.text,text)))return;
        state.seq++;
        state.messages.push({id:`npc:${current.signature}:${state.seq}`,contactKey:contact.key,
            idx:current.index,tagStart:100000+state.seq,text});
        state.messages=state.messages.slice(-160);
        saveMeta();invalidateChatCache();
        api.checkNewIncoming?.();api.updateFabBadge?.();if(api.isPhoneOpen?.())api.render?.();
        // Optional phone-to-RP bridge uses the existing private journal, not
        // an injected instruction. Only the sender and player know this SMS.
        void logSocialToChat(`На телефон игрока пришло личное SMS от ${contact.name}: «${text}». Это известно отправителю и получателю, а не всем персонажам мира.`,
            {priv:true,marker:`npc-sms:${state.seq}`});
    }catch(e){
        if(e?.name!=='AbortError')console.warn('[GlassPhone] NPC initiative generation failed:',e);
    }finally{inProgress.delete(meta);}
}
