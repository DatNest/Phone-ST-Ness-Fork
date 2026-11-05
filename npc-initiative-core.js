// Pure, testable validation rules for NPC initiative.
export function npcMessageKey(text) {
    return String(text||'').normalize('NFKC').toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}
export function npcMessagesSimilar(a,b) {
    const x=npcMessageKey(a),y=npcMessageKey(b);
    if (!x || !y) return false;
    if (x===y) return true;
    if (Math.min(x.length,y.length)<26) return false;
    const words=s=>new Set(s.split(' ').filter(w=>w.length>=3));
    const A=words(x),B=words(y);
    const union=new Set([...A,...B]);
    return union.size>=4 && [...A].filter(w=>B.has(w)).length/union.size>=0.88;
}
export function selectNpcDecision(raw, kind, contacts) {
    if (!raw || typeof raw!=='object' || Array.isArray(raw)) return null;
    if(raw.kind==='none') return {kind:'none'};
    if(raw.kind!==kind) return null;
    const chosen=contacts.find(c=>c.key===raw.contact_key);
    if(!chosen) return null;
    const text=String(raw.text||'').trim().slice(0,1200);
    const reason=String(raw.reason||'').trim().slice(0,300);
    if(kind==='sms' && (!text || /<!--\s*tel:|\{\{user\}\}|\[\[/.test(text))) return null;
    if(kind==='call' && !reason) return null;
    return {kind,contact:chosen,text,reason};
}
export function eligibleInitiativeContact(contact, {isBlocked=()=>false,isPublic=()=>false}={}) {
    return !!(contact && !contact.isGroup && contact.key && contact.originalName &&
        (contact.numberKnown || contact.number) && !isBlocked(contact.key) && !isPublic(contact.key));
}
