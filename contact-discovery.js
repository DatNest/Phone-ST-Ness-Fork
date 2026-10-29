// RP contact discovery. Pure parser: only explicit exchanges involving the player.
// No LLM calls, no invented digits, no reliance on the narrator card's name.
const NAME = String.raw`[\p{Lu}][\p{L}.'’\-]*(?:\s+[\p{Lu}][\p{L}.'’\-]*){0,2}`;
const NUMBER = /\+?\d[\d\s()\-]{5,22}\d/g;
const PHONE_WORDS = /(?:(?<![\p{L}\p{N}_])номер(?![\p{L}\p{N}_])|телефон(?:ный)?\s+номер|номер(?:ок)?\s+телефона|(?:свой|его|её|ее|мой|мне|твой)\s+номер|контакт(?:ы)?|phone\s+number|mobile\s+number|cell\s+number|my\s+number|his\s+number|her\s+number)/iu;
const NOT_PHONE = /(?:номер\s+(?:заказа|сч[её]та|карты|квитанции|документа|машины|автомобиля|билета|квартиры|дома|страницы)|order\s+number|account\s+number|card\s+number|tracking\s+number)/iu;
const NUMBER_AS_PHONE = /(?:телефон(?:ный)?\s+номер|номер\s+телефона|(?:свой|его|е[её]|мой|твой)\s+номер|phone\s+number|mobile\s+number|cell\s+number|звони|позвони|набери|call\s+me|text\s+me)/iu;
const EXCHANGE = /(?:держи(?:те)?\s+(?:мой|мои)\s+номер|(?:вот|это)\s+мой\s+номер|обменял[а-яё]*|поменял[а-яё]*|поделил[а-яё]*|дал[аио]?|передал[аио]?|написал[аио]?|обменял[а-яё]*|поменял[а-яё]*|вручил[аио]?|скинул[аио]?|отправил[аио]?|продиктовал[аио]?|записал[аио]?|сохран[а-яё]*|получил[аио]?|взял[аио]?|узнал[аио]?|есть\s+номер|имеет\s+номер|exchang\w*|shar\w*|gave|sent|saved|received|got|have\s+(?:his|her|their)\s+number)/iu;
const NEGATION = /(?:не\s+(?:дал[аио]?|передал[аио]?|записал[аио]?|сохран[а-яё]*|получил[аио]?|узнал[аио]?|обменял[а-яё]*)|не\s+стал[аи]?\s+(?:давать|записывать|сохранять)|отказал[а-яё]*|ещ[её]\s+не|так\s+и\s+не|хотел[а-яё]*\s+бы|мог[а-яё]*\s+бы|нужно\s+(?:узнать|получить)|предложил[а-яё]*\s+обменяться|собирал[а-яё]*\s+передать|потом\s+(?:отправит|передаст)|обещал[а-яё]*\s+(?:передать|дать|прислать)|would\s+(?:give|share)|did\s+not\s+(?:give|share)|never\s+(?:gave|shared)|didn't\s+(?:give|share))/iu;
const USER_REFERENCE = /(?<![\p{L}\p{N}_])(?:you|your|me|my|мне|меня|мой|мо[её]м|тебе|тебя|твой)(?![\p{L}\p{N}_])/iu;
const NOISE = /(?:нарратор|narrator|рассказчик|повествователь|assistant|system|user|char|персонаж|неизвестный|пользователь)/iu;
const DATE_LIKE = /^(?:\d{4}[-.]\d{1,2}[-.]\d{1,2}|\d{1,2}[-.]\d{1,2}[-.]\d{2,4}|\d{1,2}:\d{2})$/u;
const clean = s => String(s || '').normalize('NFC').replace(/\s+/g,' ').trim();
function validName(s, userName) {
    const name = clean(s).replace(/^[«"']|[»"'.,;:!?]+$/g,'').replace(/[.,;:!?»"']+$/g,'').trim();
    return name && name.length <= 80 && !/^(?:я|мы|ты|вы|он|она|они|i|we|you|he|she|they)$/iu.test(name) && !NOISE.test(name) && name.toLocaleLowerCase() !== clean(userName).toLocaleLowerCase() ? name : '';
}
function withoutPhoneTags(text) {
    return String(text || '').replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi,'')
        .replace(/<!--[\s\S]*?-->/g,' ').replace(/\[(?:СМС|SMS|Голосовое|Voice)\s*(?:→|в\s+чат|to\s+chat)[^\]]*\][^\n]*/gi,' ')
        .replace(/https?:\/\/\S+/gi,' ').slice(0,28000);
}
function numberIn(sentence) {
    NUMBER.lastIndex = 0;
    for (const match of sentence.matchAll(NUMBER)) {
        const candidate = match[0].trim(), digits = candidate.replace(/\D/g,'');
        if (digits.length < 7 || digits.length > 15 || DATE_LIKE.test(candidate)) continue;
        const around = sentence.slice(Math.max(0,match.index-85),Math.min(sentence.length,match.index+candidate.length+85));
        if (/\b(?:id|order|ticket|token|version|versionId)\b/i.test(around) && !PHONE_WORDS.test(around)) continue;
        if (PHONE_WORDS.test(around)||/\b(?:звони|позвони|набери|пиши\s+мне|call\s+me|text\s+me)\b/iu.test(around)) return candidate;
    }
    return '';
}
function namesInText(text) {
    const names = [];
    const patterns = [
        new RegExp(String.raw`(?:^|[\s\n«"'])(${NAME})\s+(?:дал[аио]?|передал[аио]?|написал[аио]?|отправил[аио]?|продиктовал[аио]?|записал[аио]?|скинул[аио]?|сообщил[аио]?|вручил[аио]?|поделил[а-яё]*|обменял[а-яё]*|поменял[а-яё]*|gave|sent|shared)(?=\s|[.,:;]|$)`,'gu'),
        new RegExp(String.raw`(?:номер|контакт|number)\s+(?:телефона\s+)?(${NAME})(?=\s|[.,:;]|$)`,'gu'),
        new RegExp(String.raw`(?:от|у|from)\s+(${NAME})\s+(?:номер(?:\s+телефона)?|контакт|number)(?=\s|[.,:;]|$)`,'gu'),
        new RegExp(String.raw`(?:номер|контакт|number)\s+(?:телефона\s+)?(?:от|у|from)\s+(${NAME})(?=\s|[.,:;]|$)`,'gu'),
        new RegExp(String.raw`(?:обменял[а-яё]*|поменял[а-яё]*|exchanged)\s+(?:ся\s+)?(?:номерами|контактами|numbers)?\s+(?:с|with)\s+(${NAME})(?=\s|[.,:;]|$)`,'gu'),
        new RegExp(String.raw`(?:^|\n)\s*(${NAME})\s*:\s*(?:[+\d]|[«"'])`,'gu'),
        new RegExp(String.raw`(?:сохранил[а-яё]*|записал[а-яё]*|узнал[а-яё]*|получил[а-яё]*)\s+(?:номер|контакт)\s+(${NAME})(?=\s|[.,:;]|$)`,'gu'),
    ];
    for (const pattern of patterns) for (const match of text.matchAll(pattern)) names.push({name:clean(match[1]),at:match.index});
    return names;
}
function mentionsUser(text, userName) {
    const user = clean(userName);
    if (user) {
        const escaped = user.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        if (new RegExp(String.raw`(^|[^\p{L}\p{N}_])${escaped}($|[^\p{L}\p{N}_])`,'iu').test(text)) return true;
        const first = user.split(' ')[0];
        if (first.length >= 3 && first !== user) return mentionsUser(text, first);
    }
    return USER_REFERENCE.test(text);
}
function collectSentences(text) {
    // Treat nearby dialogue, action and narration as one unit; don't borrow an
    // unrelated phone number from another turn or a distant paragraph.
    return text.split(/(?<=[.!?。])\s+|\n\s*\n/).flatMap(part=>part.length>650?part.match(/[\s\S]{1,650}/g)||[]:[part]).filter(Boolean);
}
export function discoverRpContacts(message, {userName = '', mainCharacterName = '', narratorMode = false} = {}) {
    if (!message || message.is_system || message.name === 'GlassPhone' || message.extra?.model === 'GlassPhone') return [];
    const raw = withoutPhoneTags(message.mes);
    if (!raw.trim()) return [];
    const directAuthor = !message.is_user && !narratorMode ? validName(message.name || mainCharacterName, userName) : '';
    const results = new Map();
    const units = collectSentences(raw);
    for (const segment of units) {
        if (!PHONE_WORDS.test(segment) && !/(?:обменял[а-яё]*|поменял[а-яё]*|exchanged)\s+(?:с\s+\S+\s+)?(?:номерами|контактами|numbers)/iu.test(segment)) continue;
        if (NEGATION.test(segment) || NOT_PHONE.test(segment)) continue;
        const number = numberIn(segment);
        const transfer = EXCHANGE.test(segment);
        // Explicit numeric exchange and known-number statement both count.
        if (!transfer && (!number || !NUMBER_AS_PHONE.test(segment))) continue;
        let persons = namesInText(segment).filter(p=>validName(p.name,userName));
        // Explicit partner exchange: "X и Y обменялись номерами".
        const exchange = segment.match(new RegExp(String.raw`(${NAME})\s+(?:и|and|&)\s+(${NAME})\s+(?:обменял[а-яё]*|поменял[а-яё]*|exchanged)`,'u'));
        if (exchange) persons.push({name:clean(exchange[1]),at:0},{name:clean(exchange[2]),at:0});
        // "Я взяла номер X", "Ты сохранила номер X" is player-authored evidence.
        if (message.is_user && !persons.length) {
            const userGot = segment.match(new RegExp(String.raw`(?:номер|контакт)\s+(${NAME})`,'u'));
            if (userGot) persons.push({name:clean(userGot[1]),at:0});
        }
        const recipientEstablished = mentionsUser(segment, userName) ||
            (message.is_user && /(?<![\p{L}\p{N}_])(?:я|мы|мне|меня|my|me|i|we)(?![\p{L}\p{N}_])/iu.test(segment)) ||
            (directAuthor && /(?:вот|держи|запиши|это|here(?:'s| is)|my number|мой номер|звони|пиши\s+мне)/iu.test(segment));
        if (!recipientEstablished) continue;
        if (!persons.length && directAuthor) persons = [{name:directAuthor,at:0}];
        if (!persons.length) continue;
        // When an author speaks in first person, the number belongs to the speaker,
        // not some person incidentally mentioned in the sentence.
        if (directAuthor && /(?:мой\s+номер|вот\s+мой\s+номер|my\s+number)/iu.test(segment)) persons=[{name:directAuthor,at:0}];
        for (const person of persons) {
            const name = validName(person.name,userName);
            if (!name || (directAuthor && name.toLowerCase() !== directAuthor.toLowerCase() && !mentionsUser(segment,userName) && !message.is_user)) continue;
            const key=name.toLocaleLowerCase();
            const prior=results.get(key);
            if (!prior) results.set(key,{name,number,numberKnown:true,source:'rp-exchange'});
            else if (!prior.number && number) prior.number=number;
        }
    }
    return [...results.values()];
}
