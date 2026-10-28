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
