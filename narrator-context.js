// Multi-character narrator card mode. Read only the active card and this RP chat.
// Detection is advisory: people mentioned in the story are not automatically
// known to the user or entitled to a phone account.
import { getMeta, keyOf, scanChat } from './state.js';
import { publicRoleplayMessage } from './private-context.js';
import { getPhoneMessageText, stripThink } from './state.js';

export function narratorMode() { return getMeta().narratorMode === true; }
export function roleplayCast({ publicOnly = false, max = 45 } = {}) {
    if (!narratorMode()) return [];
    let ctx;
    try { ctx = SillyTavern.getContext(); } catch { return []; }
    const card = ctx?.characters?.[ctx.characterId];
    const description = [card?.description, card?.data?.description,
        card?.scenario, card?.data?.scenario, card?.personality, card?.data?.personality]
        .filter(Boolean).join('\n').slice(0, 30000);
    const names = new Map();
    const meta = getMeta();
    if (!Array.isArray(meta.narratorKnownActors)) meta.narratorKnownActors = [];
    for (const recorded of meta.narratorKnownActors.slice(0,max)) {
        if (recorded?.name && recorded?.source === 'dialogue') names.set(keyOf(recorded.name),recorded);
    }
    const banned = new Set([keyOf(ctx?.name1), keyOf(ctx?.name2),
        'narrator', 'нарратор', 'повествователь', 'рассказчик', 'system', 'user', 'assistant', 'char']);
    const add = (name, evidence) => {
        const raw = String(name || '').replace(/[\[\]{}*_#@]/g, '').trim();
        if (!/^[A-ZА-ЯЁ][\p{L}.'’-]*(?:[ -][A-ZА-ЯЁ][\p{L}.'’-]*){0,3}$/u.test(raw)) return;
        const key = keyOf(raw);
        if (raw.length < 3 || raw.length > 65 || banned.has(key) || names.has(key)) return;
        // A short dialogue name and a full card name are the same character
        // only when the short name matches the entire first name exactly.
        const conflicts=[...names.entries()].filter(([,entry])=>{
            const x=entry.name.split(' '), y=raw.split(' ');
            return x[0]===y[0] && (x.length===1 || y.length===1);
        });
        for (const [otherKey,entry] of conflicts) {
            if (entry.name.length >= raw.length) return;
            names.delete(otherKey);
        }
        if (names.size < max) names.set(key, {name:raw, source:evidence});
    };
    // Existing address book entries are grounded, not speculative contacts.
    try { for(const c of scanChat().contacts.values()) add(c.originalName || c.name, 'contact'); } catch {}
    // Only clear person headings and role labels — not every capitalized word.
    for (const line of description.split('\n').slice(0, 600)) {
        let m=line.match(/^\s*#{1,5}\s+([A-ZА-ЯЁ][\p{L}.'’-]+(?:[ -][A-ZА-ЯЁ][\p{L}.'’-]+){0,3})\s*$/u);
        if (m) add(m[1], 'card');
        m=line.match(/^\s*(?:[-*]\s*)?([A-ZА-ЯЁ][\p{L}.'’-]+(?:[ -][A-ZА-ЯЁ][\p{L}.'’-]+){0,3})\s*[—–:]\s*(?:персонаж|character|возраст|age|роль|role|\d{1,3}\s*(?:лет|y\.o\.))/iu);
        if (m) add(m[1], 'card');
    }
    // Dialogue speaker labels are evidence of presence in the story.
    const recent=(ctx?.chat||[]).filter(m=>!m?.is_system && (!publicOnly || publicRoleplayMessage(m)) && publicRoleplayMessage(m)).slice(-400);
    for (const message of recent) {
        if(message.is_user)continue;
        const content=stripThink(getPhoneMessageText(message)).slice(0,6500);
        for (const line of content.split('\n').slice(0,45)) {
            const match=line.match(/^\s*(?:[-*]\s*)?([A-ZА-ЯЁ][\p{L}.'’-]+(?:[ -][A-ZА-ЯЁ][\p{L}.'’-]+){0,2})\s*:\s*[«"—–\p{L}]/u);
            if(match)add(match[1], 'dialogue');
        }
    }
    // Persist only public-roleplay speaker labels. This does not create accounts or contacts.
    const observed=[...names.values()].filter(x=>x.source==='dialogue').slice(-max);
    if (JSON.stringify(meta.narratorKnownActors) !== JSON.stringify(observed)) {
        meta.narratorKnownActors=observed;
        // Saving is deferred by the normal phone metadata persistence path.
    }
    return [...names.values()];
}
export function narratorGuidance({publicOnly=false}={}) {
    if(!narratorMode())return '';
    const cast=roleplayCast({publicOnly}).map(c=>c.name);
    return [
        'NARRATOR / MULTI-CHARACTER ROLEPLAY MODE (CRITICAL): The active bot card is a NARRATOR, not an in-world person, phone contact or account. Do not let Narrator narrate or post as a user.',
        'Interpret the active card as a description of a SHARED WORLD AND MANY INDEPENDENT CHARACTERS, not one speaker. Use the relevant person from the active scene, cast and lorebook for each account. Preserve independent voices, affiliations, knowledge, established relationships and timelines.',
        'A mention in the card, roster or history is not proof someone owns a social account, is a phone contact, witnessed a private moment, or knows a secret. Infer no phone numbers or past friendships.',
        'Never write any post, comment, DM, action, speech or internal thoughts FOR THE USER PERSONA. They can only act by explicit user interaction. Keep other characters autonomous.',
        'Only choose relevant believable participants. Do not populate the entire cast in every thread.',
        publicOnly?'A public account must not know secret/private events unless canonically revealed.':'Preserve per-character private knowledge and explicitly established relationships.',
        cast.length?'GROUNDED CANDIDATE NAMES (not a mandatory cast or contact list): '+cast.join('; '):'Ground candidate names in the card, lorebook and roleplay; do not invent named connections.'
    ].join('\n');
}
