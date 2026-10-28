// Clock evidence must describe the PRESENT RP moment. Appointment times, SMS,
// calendar events and private messages are NOT a change of story time.
// This module is dependency-free so its guards can be regression-tested.

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const CLOCK = '([01]?\\d|2[0-3]):([0-5]\\d)';
const CUR_CLOCK = new RegExp(
    '(?:^|[^\\p{L}\\p{N}_])(?:' +
    '(?:прямо\\s+)?сейчас\\s*(?:на\\s+часах\\s*)?(?:уже\\s*)?' +
    '|(?:на\\s+часах|по\\s+часам|часы\\s+(?:показывают|показывали|показали)|текущее\\s+время|время\\s+сейчас|время\\s+в\\s+(?:сцене|ролевой|истории)|сюжетное\\s+время|ролевое\\s+время|current\\s+(?:story\\s+|rp\\s+)?time|(?:story|rp)\\s+clock|the\\s+time\\s+is)\\s*(?::|—|–|=|было|стало|показывает|показывают|около|примерно)?\\s*' +
    '|(?:время|time)\\s*[:=]\\s*' +
    ')' + CLOCK, 'iu'
);
const HHMM = new RegExp('^' + CLOCK + '$');


// Explicit CURRENT story-clock metadata written by RP posts.
// Example: <!-- HT date=2024-10-23 | time=13:58 | when=23 октября | place=... -->
// Only the date/time fields are authoritative. "when"/"place" are NOT clock values.
// Comments are parsed before generic prose is examined, so a scheduled meeting
// elsewhere in the message cannot replace the actual story clock.
export function parseHtStoryClock(text) {
    let last = null;
    const source = String(text || '').replace(/```[\s\S]*?```/g, '');
    const comments = source.matchAll(/<!--\s*HT\b([\s\S]*?)-->/gi);
    for (const comment of comments) {
        const fields = Object.create(null);
        for (const field of comment[1].split('|')) {
            const match = /^\s*(date|time)\s*=\s*(.*?)\s*$/i.exec(field);
            if (match) fields[match[1].toLowerCase()] = match[2].replace(/^["']|["']$/g, '').trim();
        }
        let date = null, time = null;
        const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(fields.date || '');
        const dotted = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(fields.date || '');
        if (iso || dotted) {
            const year = Number(iso ? iso[1] : dotted[3]);
            const month = Number(iso ? iso[2] : dotted[2]);
            const day = Number(iso ? iso[3] : dotted[1]);
            const check = new Date(0);
            check.setFullYear(year, month - 1, day);
            if (year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= 31 &&
                check.getFullYear() === year && check.getMonth() === month - 1 && check.getDate() === day) {
                date = { year, month, day };
            }
        }
        const clock = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(fields.time || '');
        if (clock) time = { hours: Number(clock[1]), minutes: Number(clock[2]) };
        if (date || time) last = { date, time };
    }
    return last;
}

export function isPhoneOnlyClockMessage(message) {
    if (!message?.mes) return false;
    if (message.extra?.isSmsSilent) return true;
    const raw = String(message.mes);
    const visible = raw.replace(HTML_COMMENT_RE, '').trim();
    if (!visible && /<!--\s*tel:(?:sms|out|sent|igdm|plan|bank|silent):/i.test(raw)) return true;
    if (/^\[(?:СМС|SMS|Голосовое|Voice)\s*(?:→|в\s+чат|to\s+chat)/i.test(visible)) return true;
    if (/<!--\s*tel:log\s*-->|\[Событие мира\s*[—-]\s*соцсети\/телефон\]/i.test(raw)) return true;
    return false;
}

// Returns a deliberately narrow time reference (HH:MM), or null.
// It is never appropriate to run a loose HH:MM parser on arbitrary RP dialogue.
export function extractPresentRpClock(text) {
    const source = String(text || '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(HTML_COMMENT_RE, '');
    for (const line of source.split(/\n/).reverse()) {
        const statement = line.trim();
        if (!statement) continue;
        // Match ONLY immediate, explicit clock declarations, not times of plans,
        // deadlines, appointments or quoted messages.
        const found = CUR_CLOCK.exec(statement);
        const prefix = found ? statement.slice(0,found.index) : '';
        // An SMS or quoted speaker saying "Сейчас 17:30" is not a scene clock.
        const insideQuote = /[«"“][^»"”]*$/.test(prefix);
        const phoneContext = /(смс|sms|сообщени|переписк|письм|написал|текст сообщени)/iu.test(prefix);
        const time = (!insideQuote && !phoneContext ? (found?.[0] || '') : '').match(/\d{1,2}:\d{2}$/)?.[0]
            || statement.match(/^(?:\*{0,2}|\[|\()([01]?\d|2[0-3]):([0-5]\d)(?:\*{0,2}|\]|\))$/)?.[0]
                ?.match(/\d{1,2}:\d{2}/)?.[0];
        if (time && HHMM.test(time)) return time;
    }
    return null;
}

export function currentNarrativeDateLine(text) {
    const clean = String(text || '').replace(HTML_COMMENT_RE, '').replace(/```[\s\S]*?```/g, '');
    for (const line of clean.split(/\n/).reverse()) {
        const start = line.trim().replace(/^[*#\s]+/, '');
        if (/^(?:дата\s*[:=]|дата\s+и\s+время\s*[:=]|сейчас|сегодня|на\s+календаре|текущая\s+дата|сюжетная\s+дата|ролев(?:ая|ую)\s+дата|дата\s+в\s+(?:истории|ролевой)|currently|today(?:\s+is)?|current\s+(?:story\s+)?date)(?=$|[^\p{L}\p{N}_])/iu.test(start)
        ) {
            const mention = /(?:\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[.\/-]\d{1,2}(?:[.\/-]\d{2,4})?\b|\b\d{1,2}\s+[а-яa-z]{3,}\s+\d{4}\b)/iu.exec(start);
            if (!mention || mention.index > 44) continue;
            const lead=start.slice(0,mention.index);
            // 'Сегодня назначили встречу на 28 октября' is NOT today's date.
            if (/(встреч|назнач|план|договор|дедлайн|ожида|будет|завтра|tomorrow|appointment|meeting|deadline)/iu.test(lead)) continue;
            return start;
        }
    }
    return '';
}
