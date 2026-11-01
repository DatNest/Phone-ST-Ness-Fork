// Contact matching is separate from keyOf(): group and app keys keep their format.
export function cleanContactName(value) {
    return String(value ?? '').normalize('NFC').replace(/[\u200b\u2060\ufeff]/g, '').replace(/\s+/gu, ' ').trim();
}
export const contactNameKey = value => cleanContactName(value).toLowerCase();
const own = (object,key) => Object.hasOwn(object || {}, key);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);

export function redirectedContactKey(meta,key) {
    const seen = new Set();
    while (own(meta.contactKeyRedirects,key) && meta.contactKeyRedirects[key] && !seen.has(key)) {
        seen.add(key); key = meta.contactKeyRedirects[key];
    }
    return key;
}

// A full character name is evidence of an identity. A display label is not.
// First-name matching is allowed only when ONE established full-name contact
// fits and there is no conflicting phone number or saved label.
function fullPersonName(value) {
    const words = cleanContactName(value).split(' ');
    return words.length >= 2 && words.length <= 4 && words.every(part => /^[\p{L}][\p{L}'’.-]*$/u.test(part));
}

function firstNameForms(first) {
    const value = contactNameKey(first);
    const forms = new Set([value]);
    // Only generate grammatical forms of a KNOWN first name, never reverse
    // arbitrary words to invent a character identity.
    if (!/^[а-яё]+$/iu.test(value)) return forms;
    const last = value.slice(-1), stem = value.slice(0,-1);
    if (last === 'а') {
        for (const ending of [/[гкхжчшщ]$/u.test(stem)?'и':'ы','е','у','ой','ей']) forms.add(stem+ending);
    } else if (last === 'я') {
        for (const ending of ['и','е','ю','ей']) forms.add(stem+ending);
    } else if (last === 'й') {
        for (const ending of ['я','ю','ем','е']) forms.add(stem+ending);
    } else if (last === 'ь') {
        for (const ending of ['я','ю','ем','е','и','ью']) forms.add(stem+ending);
    } else if (/[бвгджзклмнпрстфхцчшщ]$/u.test(last)) {
        for (const ending of ['а','у','ом','е']) forms.add(value+ending);
    }
    return forms;
}

function savedNumber(meta,key) {
    const values = (meta.contacts || []).filter(c=>contactNameKey(c?.name)===key)
        .map(c=>String(c.number||'').replace(/\D/g,'')).filter(Boolean);
    return values.length === 1 ? values[0] : '';
}

function uniqueFullNameMatch(meta,query,ids) {
    if (!query || query.includes(' ') || query.startsWith('group:')) return '';
    const candidates = new Set();
    const records = new Set([...Object.keys(ids),...(meta.contacts||[]).map(c=>contactNameKey(c?.name))]);
    for (const recordKey of records) {
        const item=ids[recordKey];
        const original=cleanContactName(item?.originalName || recordKey);
        if (!fullPersonName(original)) continue;
        const first=original.split(' ')[0];
        if (!firstNameForms(first).has(query)) continue;
        const fullKey=redirectedContactKey(meta,recordKey);
        candidates.add(fullKey);
    }
    if (candidates.size!==1) return '';
    const match=[...candidates][0];
    // An explicit saved personal label belonging to somebody else wins.
    for (const [key,label] of Object.entries(meta.names||{})) {
        if (redirectedContactKey(meta,key)!==match && contactNameKey(label)===query) return '';
    }
    // Two different recorded numbers are not sufficient evidence of one person.
    const a=savedNumber(meta,query),b=savedNumber(meta,match);
    if (a && b && a!==b) return '';
    return match;
}

export function resolveIdentity(meta,value) {
    const wanted = contactNameKey(value);
    if (!wanted || wanted.startsWith('group:')) return wanted;
    const redirected = redirectedContactKey(meta,wanted);
    if (redirected !== wanted) return redirected;
    const originals = new Set(), aliases = new Set();
    const ids = meta.contactIdentities || {};
    for (const k of new Set([...Object.keys(ids), ...Object.keys(meta.names || {}), ...Object.keys(meta.handles || {})])) {
        if (k.startsWith('group:')) continue;
        const canonical = redirectedContactKey(meta,k), item = ids[k];
        if ([k,item?.originalName].some(name => name && contactNameKey(name) === wanted)) originals.add(canonical);
        const names = [meta.names?.[k], ...(Array.isArray(item?.aliases) ? item.aliases : []), meta.handles?.[k]];
        if (names.some(name => name && (contactNameKey(name) === wanted || contactNameKey(String(name).replace(/^@+/,'')) === contactNameKey(wanted.replace(/^@+/,''))))) aliases.add(canonical);
    }
    // A matching established full name, or a custom label, is stronger than a
    // first-name shortcut (which could refer to several different people).
    if (originals.size===1 && [...originals][0].includes(' ')) return [...originals][0];
    if (aliases.size===1 && [...aliases][0]!==wanted) return [...aliases][0];
    const full = uniqueFullNameMatch(meta,wanted,ids);
    if (full) return full;
    if (originals.size===1) return [...originals][0];
    if (aliases.size===1) return [...aliases][0];
    return own(ids,wanted) ? wanted : wanted;
}

function laterRead(a,b) {
    const cursor = value => typeof value === 'string' && /^\d+:\d+$/.test(value) ? value.split(':').map(Number) : null;
    const ac = cursor(a), bc = cursor(b);
    if (ac && bc) return ac[0] > bc[0] || (ac[0] === bc[0] && ac[1] >= bc[1]) ? a : b;
    if (ac || bc) return ac ? a : b;
    return Math.max(Number(a) || 0,Number(b) || 0);
}

// Merge only exact names differing in whitespace / Unicode composition.
// Similar first names, diminutives and unrelated equal labels are not evidence.
export function repairContactMetadata(meta) {
    const ids = meta.contactIdentities, families = new Map();
    if (!plain(ids)) return false;
    if (!plain(meta.contactKeyRedirects)) meta.contactKeyRedirects = {};
    const parent = new Map();
    const keys = Object.keys(ids).filter(k=>!k.startsWith('group:'));
    const find = key => { let next=key;while(parent.get(next)!==next)next=parent.get(next);return next; };
    keys.forEach(key=>parent.set(key,key));
    const byName = new Map();
    for (const key of keys) {
        for (const name of [key,ids[key]?.originalName]) {
            const match = contactNameKey(name); if (!match) continue;
            const previous = byName.get(match);
            if (previous) parent.set(find(key),find(previous)); else byName.set(match,key);
        }
    }
    // Migrate already-saved short/inflected contacts into a unique full-name
    // identity. Never infer a match when several full names share that first name.
    for (const key of keys) {
        const target=resolveIdentity(meta,key);
        if (target!==key && parent.has(target)) parent.set(find(key),find(target));
    }
    for (const key of keys) { const root=find(key);if(!families.has(root))families.set(root,[]);families.get(root).push(key); }
    let changed = false;
    const score = key => (fullPersonName(ids[key]?.originalName || key) ? 3000 : 0) + (meta.names?.[key] ? 1000 : 0)
        + (meta.contacts.some(c=>String(c.name||'').trim().toLowerCase()===key && c.number) ? 100 : 0)
        + (meta.avatars?.[key] ? 50 : 0) + (meta.handles?.[key] ? 30 : 0)
        + (key === contactNameKey(key) ? 10 : 0);
    for (const family of families.values()) {
        if (family.length < 2) continue;
        const canonical = [...family].sort((a,b)=>score(b)-score(a))[0];
        if (!plain(ids[canonical])) ids[canonical]={originalName:canonical,aliases:[]};
        const record = ids[canonical];
        if (!Array.isArray(record.aliases)) record.aliases=[];
        for (const old of family) {
            if (old === canonical) continue;
            const previous = ids[old];
            record.aliases.push(old,previous?.originalName,meta.names?.[old],meta.handles?.[old],...(Array.isArray(previous?.aliases) ? previous.aliases : []));
            Object.defineProperty(meta.contactKeyRedirects,old,{value:canonical,writable:true,configurable:true,enumerable:true});
            for (const field of ['names','handles','avatars','avatarProfiles','threadAppearance']) {
                const map=meta[field];if(!plain(map)||!own(map,old))continue;
                if (!own(map,canonical) || !map[canonical]) map[canonical]=map[old];
                else if (field === 'threadAppearance' && plain(map[old]) && plain(map[canonical])) map[canonical]={...map[old],...map[canonical]};
                delete map[old];
            }
            if (own(meta.lastRead,old)) { meta.lastRead[canonical]=laterRead(meta.lastRead[canonical],meta.lastRead[old]);delete meta.lastRead[old]; }
            if (own(meta.smsBlocks,old)) {
                const ranges=[...(meta.smsBlocks[canonical] || []),...(meta.smsBlocks[old] || [])];
                meta.smsBlocks[canonical]=[...new Map(ranges.map(r=>[JSON.stringify(r),r])).values()];delete meta.smsBlocks[old];
            }
            delete ids[old];changed=true;
        }
        record.aliases=[...new Set(record.aliases.filter(v=>typeof v==='string'&&v))];
    }
    if (!changed) return false;
    for (const old of Object.keys(meta.contactKeyRedirects)) meta.contactKeyRedirects[old]=redirectedContactKey(meta,meta.contactKeyRedirects[old]);
    const contacts = new Map();
    for (const contact of meta.contacts) {
        const raw=String(contact.name || '').trim().toLowerCase(), key=resolveIdentity(meta,raw);
        const previous=contacts.get(key), name=ids[key]?.originalName || contact.name;
        if (!previous) contacts.set(key,{...contact,name});
        else {
            const previousNumber=previous.number;
            if(raw===key){const number=previous.number;Object.assign(previous,contact,{name});if(!previous.number)previous.number=number;}
            if (!previous.number && contact.number) previous.number=contact.number;
            if (previousNumber && contact.number && previousNumber !== contact.number) {
                const record=ids[key];record.numbers=[...new Set([...(record.numbers || []),previousNumber,contact.number])];
            }
            for (const [field,value] of Object.entries(contact)) if (previous[field] == null) previous[field]=value;
        }
    }
    meta.contacts=[...contacts.values()];
    const hidden = new Map();
    for (const item of meta.hidden || []) {
        if (!item?.key) continue;
        const key=item.key.startsWith('group:') ? item.key : resolveIdentity(meta,item.key), previous=hidden.get(key);
        if (!previous || (item.atIdx ?? -1) > (previous.atIdx ?? -1)) hidden.set(key,{...item,key});
    }
    meta.hidden=[...hidden.values()];
    for (const call of meta.calls?.history || []) if (call.key) call.key=resolveIdentity(meta,call.key);
    if(meta.lastRenamedContact)meta.lastRenamedContact=resolveIdentity(meta,meta.lastRenamedContact);
    return true;
}
