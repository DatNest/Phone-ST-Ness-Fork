import { normalizePhoneSpaces, parsePhoneJson } from './phone-text.js';
const TAGS = /<!--\s*tel:(sent|sms):(\{[\s\S]*?\})\s*-->/gi;
const OUTGOING = /<!--\s*tel:out:(\{[\s\S]*?\})\s*-->/gi;
const norm = value => normalizePhoneSpaces(value).trim().replace(/^@+/, '').toLocaleLowerCase();
const escape = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const parse = value => { try { return parsePhoneJson(value); } catch (_error) { return null; } };

export function extractRoleplaySms(text, { otherNames = [] } = {}) {
    const source = String(text || '').replace(/<!--[\s\S]*?-->|```[\s\S]*?```/g, value => ' '.repeat(value.length));
    const candidates = [];
    let ordinal = 0;
    for (const match of source.matchAll(/(?<!`)`([^`\n]+)`(?!`)/g)) {
        const quoteIndex = ordinal++;
        const body = match[1].trim();
        if (!body || /^\[(?:СМС|SMS|Голосовое|Voice)\b/i.test(body) || /^\s*(?:const |let |var |\{|\/)/.test(body)) continue;
        const before = source.slice(Math.max(0, match.index - 180), match.index);
        const clause = before.split(/[.!?;\n]/u).at(-1) || '';
        const after = source.slice(match.index + match[0].length, match.index + match[0].length + 90);
        // Never infer an outgoing message from a received notification,
        // quoted conversation, a social post, or another person's action.
        if (/(?:прочитал[аи]?|получил[аи]?|увидел[аи]?|пришло|входящее|сообщение\s+от|смс\s+от|цитат|подпись|опубликов|(?:^|\s)пост(?:\s|$)|read\s+(?:a\s+)?message|received|caption|posted)/iu.test(clause)) continue;
        if (/(?:он|она|они|бот|персонаж|he|she|they)\s+(?:\S+\s+){0,2}(?:пишет|написал[аи]?|ответил[аи]?|отправил[аи]?|набрал[аи]?|читает|writes|texts|sent|replied)/iu.test(clause)) continue;
        if (/^\s*[,—-]?\s*(?:написал|прислал|отправил|пишет|wrote|sent)\s+(?:он|она|бот|персонаж|he|she)(?![\p{L}\p{N}_])/iu.test(after)) continue;
        if (/(?:хотел[аи]?|собирал(?:ся|ась)|думал[аи]?|черновик|не\s+(?:отправил[аи]?|написал[аи]?)|wanted\s+to|draft|did\s+not\s+send|never\s+sent)/iu.test(clause + ' ' + after)) continue;
        const actors = otherNames.flatMap(name => [name, String(name).split(/\s+/)[0]]).filter(Boolean);
        if (actors.some(name => new RegExp(`(^|[^\\p{L}])${escape(name)}\\s+(?:\\S+\\s+){0,2}(?:пишет|написал[аи]?|отправил[аи]?|ответил[аи]?|набрал[аи]?|writes|texts|sent)`, 'iu').test(clause))) continue;
        candidates.push({ quoteIndex, text: body });
    }
    return candidates;
}

export function roleplaySmsKey(quoteIndex, text) { return JSON.stringify([quoteIndex, normalizePhoneSpaces(text)]); }

export function resolveRoleplaySms(userMessage, userIndex, replyText, options = {}) {
    if (!userMessage?.is_user || userMessage.is_system) return [];
    const candidates = extractRoleplaySms(userMessage.mes, options);
    if (!candidates.length) return [];
    const userNames = (options.userNames || []).map(norm);
    const isUser = name => userNames.includes(norm(name));
    const sent = new Map();
    for (const match of String(replyText || '').matchAll(TAGS)) {
        const data = parse(match[2]);
        if (!data) continue;
        if (match[1].toLowerCase() === 'sent') {
            if ((data.source !== userIndex && data.source !== userMessage.extra?.glassphoneRpSmsSource) || (data.from && !isUser(data.from))) continue;
            const candidate = candidates.find(item => item.quoteIndex === data.quoteIndex && normalizePhoneSpaces(item.text) === normalizePhoneSpaces(data.text).trim());
            const target = data.chat || data.to;
            if (!candidate || typeof target !== 'string' || !target.trim() || target.length > 120 || /[\r\n]/.test(target) || (data.to && isUser(data.to))) continue;
            sent.set(candidate.quoteIndex, { ...candidate, to: String(data.to || ''), group: data.chat ? String(data.chat) : null });
        }
    }
    const hidden = new Set((userMessage.extra?.glassphoneRpSmsHidden || []).map(value => {
        const key = parse(value);
        return Array.isArray(key) ? roleplaySmsKey(key[0], key[1]) : value;
    }));
    return [...sent.values()].filter(item => {
        const key = roleplaySmsKey(item.quoteIndex, item.text);
        return !hidden.has(key);
    });
}

// Reconcile every user turn with its current assistant replies after edits/swipes.
export function captureRoleplaySms(chat, readMessage, options = {}) {
    let changed = 0;
    const clean = text => String(text || '').replace(OUTGOING, (tag, json) => parse(json)?.origin === 'rp' ? '' : tag).trimEnd();
    for (let userIndex = 0; userIndex < chat.length; userIndex++) {
        const message = chat[userIndex];
        if (!message?.is_user || message.is_system) continue;
        let end = userIndex + 1;
        while (end < chat.length && !chat[end]?.is_user) end++;
        const replies = chat.slice(userIndex + 1, end).filter(item => item && !item.is_system).map(readMessage).join('\n');
        const outgoing = resolveRoleplaySms(message, userIndex, replies, options);
        const tags = outgoing.map(item => {
            const data = { to: item.to, text: item.text, mixed: true, origin: 'rp', quoteIndex: item.quoteIndex, rpQuote: item.text };
            if (item.group) data.group = item.group;
            const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
            return '<!--tel:out:' + json + '-->';
        }).join('\n');
        const update = text => clean(text) + (tags ? '\n' + tags : '');
        const next = update(message.mes);
        if (next === message.mes) continue;
        if (outgoing.length) {
            message.extra ||= {};
            message.extra.glassphoneRpSmsSource ??= userIndex;
        }
        message.mes = next;
        if (typeof message.extra?.display_text === 'string') message.extra.display_text = update(message.extra.display_text);
        if (typeof message.swipes?.[message.swipe_id] === 'string') message.swipes[message.swipe_id] = next;
        changed++;
    }
    return changed;
}

export function hasMixedRoleplaySms(message) {
    return [...String(message?.mes || '').matchAll(OUTGOING)].some(match => parse(match[1])?.mixed === true);
}

export function roleplaySmsDirective(chat, options = {}) {
    let source = -1;
    for (let index = chat.length - 1; index >= 0; index--) {
        if (chat[index]?.is_user && !chat[index].is_system) { source = index; break; }
    }
    if (source < 0) return '';
    const candidates = extractRoleplaySms(chat[source].mes, options);
    if (!candidates.length) return '';
    return `[MIXED ROLEPLAY + SMS] Latest user message, source ${source}, contains indexed backtick fragments: ${JSON.stringify(candidates)}. Use scene context to identify messages actually SENT BY {{user}} and their recipients. For each append <!--tel:sent:{"source":${source},"quoteIndex":0,"to":"canonical recipient","text":"exact fragment"}--> with the real quoteIndex; for groups replace "to" with "chat":"group name". Preserve the fragment verbatim. Omit drafts, received/quoted text, posts, other people’s messages and unclear recipients. Continue visible roleplay normally; this is not phone-only mode. Incoming tel:sms may target only {{user}} and must include "to":"{{user}}".\n`;
}

// RP-text SMS evidence. Pure, read-only detection: the regular phone-tag reader
// and these events share ONE phone-book/thread store in state.scanChat().
// No model calls, prompt injection, guessed numbers, or changes to RP messages.
const RP_MESSAGE_QUOTE = /«([^»\n]{1,750})»|“([^”\n]{1,750})”|"([^"\n]{1,750})"|`([^`\n]{1,750})`/gu;
const RP_SEND = /(?:отправил[аио]?|послал[аио]?|прислал[аио]?|скинул[аио]?|написал[аио]?|ответил[аио]?|отписал[аио]?|отослал[аио]?|sent|texted|messaged|replied|wrote)/iu;
const RP_RECEIVE = /(?:получил[аио]?|прочитал[аио]?|прочл[аои]?|пришл[оаи]|увидел[аи]?\s+(?:новое\s+)?сообщение|received|got\s+(?:a\s+)?(?:text|message))/iu;
const RP_MOBILE = /(?:смс|sms|сообщени[еяию]|переписк[ауеой]|мессенджер|чат[аеу]?|телефон[аеуом]?|экран[аеуом]?|text(?:\s+message)?|messag(?:e|ing)|DM\b|личк[аеуи])/iu;
const RP_UNSENT = /(?:черновик|не\s+(?:отправил[аи]?|написал[аи]?|послал[аи]?|стал[аи]?\s+отправлять)|так\s+и\s+не\s+отправил|собирал(?:ся|ась)\s+(?:написать|отправить)|хотел[аи]?\s+(?:написать|отправить)|передумал[аи]?\s+отправлять|неотправленн|draft|did\s+not\s+send|never\s+sent|was\s+going\s+to\s+text)/iu;
const RP_TEL_TAG = /<!--\s*tel:(?:sms|out|sent|log|contact):[\s\S]*?-->/giu;
const RP_NOISE = /^(?:narrator|нарратор|рассказчик|повествователь|user|assistant|system|персонаж|он|она|они|ты|я)$/iu;
const RP_NAME = String.raw`[\p{Lu}][\p{L}’'.-]{1,35}(?:\s+[\p{Lu}][\p{L}’'.-]{1,35}){0,2}`;
const RP_FROM = new RegExp(String.raw`(?:от|from)\s+(${RP_NAME})(?=\s*[:—,.]|\s+(?:сообщени|смс|sms)|$)`, 'gu');
const rpName = value => String(value || '').normalize('NFC').replace(/\s+/gu,' ').replace(/[«»"'`.,:!?;]+$/gu,'').trim();
function rpFullName(name) { return rpName(name).toLocaleLowerCase('ru'); }
function rpAliasMatch(fragment, name) {
    const f=rpFullName(fragment), n=rpFullName(name);
    if (!f || !n) return false;
    if (f===n) return true;
    const first=n.split(' ')[0];
    if (f===first) return true;
    // Only resolve declined first names from a known original. No arbitrary
    // suffix-stripping on unidentified people (which can merge distinct NPCs).
    if (first.length < 4 || !/^[а-яё]+$/iu.test(first)) return false;
    const root=first.replace(/[аяйь]$/u,'');
    return root.length>=3 && f.startsWith(root) && f.length-root.length<=3 &&
        new Set([first,root+'а',root+'у',root+'е',root+'ом',root+'я',root+'ю',root+'ем',root+'и',root+'ой',root+'ей',root+'ы']).has(f);
}
function rpActor(fragment, names) {
    const raw=rpName(fragment);
    if (!raw || RP_NOISE.test(raw)) return '';
    const matches=[...new Set(names.filter(n=>rpAliasMatch(raw,n)).map(rpName))];
    // Prefer the one full name over an ambiguous same-first-name set.
    if (matches.length===1) return matches[0];
    if (matches.length>1) {
        const exact=matches.filter(name=>rpFullName(name)===rpFullName(raw));
        if (exact.length===1) return exact[0];
        return '';
    }
    return /^[\p{Lu}][\p{L}’'.-]{1,35}(?:\s+[\p{Lu}][\p{L}’'.-]{1,35}){0,2}$/u.test(raw) ? raw : '';
}
function rpMention(text,name) {
    const first=rpName(name).split(' ')[0];
    if (!first) return false;
    const stem=first.length>=4?first.replace(/[аяйь]$/u,''):first;
    return new RegExp(String.raw`(^|[^\p{L}\p{N}_])${escape(stem)}[\p{L}]{0,3}(?=$|[^\p{L}\p{N}_])`,'iu').test(text);
}
function rpActorBefore(text, verb, names) {
    const at=text.search(verb);
    if(at<0) return '';
    // Nearest named subject before the action wins; an earlier observer can
    // appear in “X saw Y send a message”, and must not become sender.
    const prefix=text.slice(Math.max(0,at-160),at);
    const candidates=[...prefix.matchAll(new RegExp(RP_NAME,'gu'))]
        .filter(m=>!/(?:^|[^\p{L}])(?:на|к|для|с|у|от|про|о)\s+$/iu.test(prefix.slice(Math.max(0,m.index-20),m.index)))
        .map(m=>rpActor(m[0],names)).filter(Boolean);
    return candidates.at(-1)||'';
}
function rpNamesFollowingVerb(text,names,verb,limit=110) {
    const at=text.search(verb);
    if(at<0) return '';
    const rest=text.slice(at).replace(verb,'').slice(0,limit)
        .replace(/^\s*(?:смс|sms|сообщение|сообщения|ответ|текст|a\s+text|a\s+message)\s*/iu,'').trimStart();
    for (const name of [...names].sort((a,b)=>b.length-a.length)) {
        const escaped=escape(rpName(name));
        if (new RegExp(String.raw`(?:^|\s|\b(?:для|кому|to|к)\s+)${escaped}(?:[\p{L}]{0,3})?(?=\s|[,:;.!?]|$)`,'iu').test(rest)) return name;
        // Single first name with inflection (e.g. Кларку for Кларк Кент).
        const part=rpName(name).split(' ')[0];
        const found=rest.match(new RegExp(String.raw`(?<![\p{L}])${escape(part)}[\p{L}]{0,3}(?![\p{L}])`,'iu'));
        if(found && rpAliasMatch(found[0],name)) return name;
    }
    const m=rest.match(new RegExp(String.raw`^(?:(?:для|to|к)\s+)?(${RP_NAME})(?=\s*[:—,.]|\s+(?:смс|sms|сообщени)|$)`,'u'));
    return m?rpActor(m[1],names):'';
}
function rpExplicitRecipient(text,names) {
    const m=text.match(new RegExp(String.raw`(?:для|кому|адресату|to)\s+(${RP_NAME})(?=\s*[:—,.]|\s+(?:смс|sms|сообщени)|$)`,'iu'));
    if(m) return rpActor(m[1],names);
    return '';
}
function rpIsUser(name,userNames) {return !!name && userNames.some(user=>rpAliasMatch(name,user));}
function rpPartyContext(pre,following,options) {
    const userNames=options.userNames || [], otherNames=options.otherNames || [];
    const names=[...new Set([...userNames,...otherNames].map(rpName).filter(Boolean))];
    const messageIsUser=options.isUser===true;
    let sender='',recipient='';
    // “Несс получила сообщение от Кларка” and “Несс увидела SMS от Кларка”.
    const receiver=rpActorBefore(pre,RP_RECEIVE,names);
    RP_FROM.lastIndex=0;
    let from=''; for(const m of pre.matchAll(RP_FROM)) {const actor=rpActor(m[1],names);if(actor)from=actor;}
    if(receiver && from && RP_RECEIVE.test(pre)) {sender=from;recipient=receiver;}
    // “Несс: ей пришло сообщение от Кларка” with explicit local recipient.
    if(!sender && from && RP_RECEIVE.test(pre)) {
        const localUser=userNames.filter(u=>rpMention(pre,u));
        if(localUser.length===1 && /(?:ей|ему|мне|на\s+е[её]\s+телефон|на\s+его\s+телефон)/iu.test(pre)){
            sender=from;recipient=localUser[0];
        }
    }
    if(!sender) {
        sender=rpActorBefore(pre,RP_SEND,names);
        // Actor may be stated after the quotation: «...», — написал Кларк.
        if(!sender) {
            const attribution=following.match(new RegExp(String.raw`^\s*[,—–-]?\s*(?:написал[аио]?|отправил[аио]?|ответил[аио]?|отписал[аио]?|sent|texted)\s+(${RP_NAME})`,'iu'));
            if(attribution) sender=rpActor(attribution[1],names);
        }
        recipient=rpExplicitRecipient(pre,names)||rpNamesFollowingVerb(pre,names,RP_SEND);
        if(!sender && messageIsUser && /(?:^|[^\p{L}])(я|мы|i|we)\s+(?:\S+\s+){0,3}(?:отправил[аио]?|написал[аио]?|ответил[аио]?|послал[аио]?|скинул[аио]?|sent|texted|replied)/iu.test(pre)) sender=userNames[0]||'';
        if(!sender && !options.narratorMode && !messageIsUser && RP_SEND.test(pre) && !/\b(?:он|она|они|they)\b/iu.test(pre)) sender=options.mainCharacterName||'';
    }
    // The nearest paragraph may establish the sender's phone conversation;
    // only use this context when one player + one NPC are unambiguous.
    if(sender && !recipient && RP_MOBILE.test(pre) && /(?:ответил|ответила|ответить|replied|ответное|продолжил\s+переписку)/iu.test(pre)) {
        const others=names.filter(name=>!rpIsUser(name,userNames) && !rpAliasMatch(name,sender) && rpMention(pre,name));
        const users=userNames.filter(name=>!rpAliasMatch(name,sender) && rpMention(pre,name));
        if(others.length===0 && users.length===1) recipient=users[0];
        else if(others.length===1 && rpIsUser(sender,userNames)) recipient=others[0];
    }
    // Conversational pronouns only if the paragraph names the intended peer;
    // never assume a narrator's unspecified “ей/ему” means the player.
    if(sender && !recipient && /(?<![\p{L}])(?:ей|ему|мне|тебе|her|him|me)(?![\p{L}])/iu.test(pre)) {
        const userCandidates=userNames.filter(u=>!rpAliasMatch(u,sender) && rpMention(pre,u));
        const otherCandidates=otherNames.filter(n=>!rpAliasMatch(n,sender) && rpMention(pre,n));
        // “X texted her” means the player only when no other plausible
        // referent occurs in the clause. Otherwise do not read private NPC DMs.
        if(userCandidates.length===1 && otherCandidates.length===0) recipient=userCandidates[0];
        else if(rpIsUser(sender,userNames) && otherCandidates.length===1) recipient=otherCandidates[0];
    }
    // If the immediately preceding RP turns established a *specific* phone
    // conversation with exactly one NPC and the player, a later “he texted
    // her” may refer to that pair. A generic encounter is not sufficient.
    if ((!sender || !recipient) && options.priorContext &&
        RP_SEND.test(pre) && RP_MOBILE.test(pre) &&
        /(?:переписк|чат\s+с|chat\s+with|text\s+conversation)/iu.test(options.priorContext)) {
        const context=String(options.priorContext).slice(-420);
        const users=userNames.filter(name=>rpMention(context,name));
        const npcs=otherNames.filter(name=>!RP_NOISE.test(name) && rpMention(context,name));
        if(users.length===1 && npcs.length===1) {
            if(!sender && /(?<![\p{L}])(?:он|она|he|she)(?![\p{L}])/iu.test(pre))
                sender=npcs[0];
            if(sender && !recipient && rpAliasMatch(sender,npcs[0]) &&
                /(?<![\p{L}])(?:ей|ему|her|him)(?![\p{L}])/iu.test(pre)) recipient=users[0];
            if(sender && !recipient && rpIsUser(sender,userNames) &&
                /(?<![\p{L}])(?:ей|ему|her|him)(?![\p{L}])/iu.test(pre)) recipient=npcs[0];
        }
    }
    if(!sender || !recipient || rpAliasMatch(sender,recipient)) return null;
    const senderUser=rpIsUser(sender,userNames), recipientUser=rpIsUser(recipient,userNames);
    if(senderUser===recipientUser) return null; // NPC↔NPC conversations are not the player's SMS.
    return { dir:senderUser?'out':'in', peer:senderUser?recipient:sender, from:sender, to:recipient };
}
export function extractNarrativeSms(message, options={}) {
    if(!message || message.is_system || message.name==='GlassPhone' || message.extra?.model==='GlassPhone') return [];
    const raw=String(options.text ?? message.mes ?? '');
    // Scanning phone-generated source again must never create an RP duplicate.
    if(!raw || (!RP_SEND.test(raw) && !RP_RECEIVE.test(raw))) return [];
    const masked=raw.replace(/<(?:think|thinking|reasoning|analysis)[^>]*>[\s\S]*?<\/(?:think|thinking|reasoning|analysis)>/giu,' ')
        .replace(RP_TEL_TAG,' ').replace(/```[\s\S]*?```/gu,' ')
        .replace(/\[(?:СМС|SMS|Голосовое|Voice)\s*(?:→|в\s+чат|to\s+chat)[^\]]*\][^\n]*/giu,' ');
    // Phone-roleplay logs have their own markers; natural prose is read only.
    if(!masked.trim()) return [];
    const results=[];
    RP_MESSAGE_QUOTE.lastIndex=0;
    for(const quote of masked.matchAll(RP_MESSAGE_QUOTE)) {
        const text=normalizePhoneSpaces(quote.slice(1).find(Boolean)||'').trim();
        if(!text || text.length>750 || /^\s*(?:отправить|send|ответить|reply|смс|sms)\s*$/iu.test(text)) continue;
        const before=masked.slice(Math.max(0,quote.index-440),quote.index);
        const after=masked.slice(quote.index+quote[0].length,quote.index+quote[0].length+145);
        const clause=before.split(/\n\s*\n|(?<=[.!?。])\s+(?=[\p{Lu}])/u).at(-1)||before;
        const trigger=RP_SEND.test(clause)||RP_RECEIVE.test(clause)||RP_SEND.test(after);
        if(!trigger) continue;
        // “Он сказал/подумал «...»” is not a text message. Require at least
        // one explicitly phone-oriented cue, or a clear actor→recipient texting
        // verb with SMS semantics (texted/messaged).
        const replyToPrior=results.length>0 && /(?:ответил[аио]?|отписал[аио]?|replied)/iu.test(clause);
        const precedingChat=/(?:переписк[ауеой]|чат[ауе]?)\s+(?:с|между)\s+[^.!?\n]{3,90}[.!?]/iu.test(before.slice(-300));
        if(!RP_MOBILE.test(clause) && !replyToPrior && !precedingChat && !/(?:texted|messaged|написал[аио]?\s+(?:смс|сообщение)|отправил[аио]?\s+(?:смс|сообщение))/iu.test(clause)) continue;
        if(RP_UNSENT.test(clause.slice(-170)+' '+after.slice(0,65))) continue;
        let parties=rpPartyContext(clause,after,{...options,isUser:!!message.is_user});
        if(!parties && results.length && /(?:ответил[аио]?|отписал[аио]?|replied)/iu.test(clause)) {
            const prior=results.at(-1);
            // Reply to the last explicit SMS in this same RP post: the other
            // party becomes sender, *only* if the target is explicit and no
            // third character is mentioned in the new clause.
            const known=[...(options.userNames||[]),...(options.otherNames||[])];
            const third=known.some(name=>!rpAliasMatch(name,prior.from) && !rpAliasMatch(name,prior.to) && rpMention(clause,name));
            if (!third && rpMention(clause,prior.from) &&
                /(?:^|[^\p{L}])(?:она|он|я|he|she|i)(?=$|[^\p{L}])/iu.test(clause)) {
                parties={dir:prior.dir==='in'?'out':'in',peer:prior.peer,from:prior.to,to:prior.from};
            }
        }
        // Two-sentence context: an active one-to-one conversation with the
        // user is an explicit recipient, not a guess from narrator identity.
        if(!parties && /(?:ответил[аио]?|прислал[аио]?|написал[аио]?|отправил[аио]?)/iu.test(clause)) {
            const previous=before.slice(0,Math.max(0,before.length-clause.length)).slice(-260);
            const scene=previous.match(/(?:переписк[ауеой]|чат[ауе]?)\s+(?:с|между)\s+([^.!?\n]{3,90})/iu);
            if(scene) {
                const recipients=(options.userNames||[]).filter(name=>rpMention(previous,name));
                const actors=(options.otherNames||[]).filter(name=>rpMention(clause,name));
                const others=(options.otherNames||[]).filter(name=>rpMention(scene[1],name));
                if(recipients.length===1 && actors.length===1 &&
                    others.every(name=>rpAliasMatch(name,actors[0]))) {
                    parties={dir:'in',peer:actors[0],from:actors[0],to:recipients[0]};
                }
            }
        }
        if(!parties) continue;
        // Existing explicit phone tags are authoritative. Match BOTH body and
        // peer/direction: two characters can independently send “OK”.
        const alreadyTagged=[...raw.matchAll(/<!--\s*tel:(sms|out):([\s\S]*?)-->/giu)].some(match=> {
            const data=parse(match[2]);
            if(!data || normalizePhoneSpaces(data.text||'').trim()!==text) return false;
            return match[1].toLowerCase()===(parties.dir==='in'?'sms':'out') &&
                rpAliasMatch(String(parties.dir==='in'?data.from:(data.to||data.contactKey)||''),parties.peer);
        });
        if(alreadyTagged) continue;
        results.push({...parties,text,eventId:`rp:${quote.index}:${results.length}`,sourceOffset:quote.index});
    }
    // Optional explicit, unquoted SMS format: “A sent B a text: Hello!”
    // or “A sent B an SMS:\n> Hello!”. The colon and explicit phone cue
    // are mandatory; never convert ordinary dialogue into a phone message.
    const plain=/^([^\n:]{4,190}(?:смс|sms|сообщени[еяию]|text\s+message)[^\n:]{0,65}):\s*(?:\n\s*>?\s*)?([^\n]{2,380})/gimu;
    for(const m of masked.matchAll(plain)) {
        if(!RP_SEND.test(m[1]) && !RP_RECEIVE.test(m[1])) continue;
        const text=normalizePhoneSpaces(m[2].replace(/^[*>_\s]+|[<*_\s]+$/g,'')).trim();
        if(!text || /^[«“"`]/u.test(text) || results.some(item=>item.text===text && item.sourceOffset>=m.index && item.sourceOffset<m.index+m[0].length)) continue;
        if(RP_UNSENT.test(m[1])) continue;
        const parties=rpPartyContext(m[1], '', {...options,isUser:!!message.is_user});
        if(!parties) continue;
        const explicitlyTagged=[...raw.matchAll(/<!--\s*tel:(sms|out):([\s\S]*?)-->/giu)].some(tag=>{
            const data=parse(tag[2]);
            return data && normalizePhoneSpaces(data.text||'').trim()===text &&
                tag[1].toLowerCase()===(parties.dir==='in'?'sms':'out') &&
                rpAliasMatch(String(parties.dir==='in'?data.from:(data.to||data.contactKey)||''),parties.peer);
        });
        if(explicitlyTagged) continue;
        results.push({...parties,text,eventId:`rp:${m.index}:${results.length}`,sourceOffset:m.index});
    }
    results.sort((a,b)=>a.sourceOffset-b.sourceOffset);
    return results;
}
