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
        if (!found) continue;
        const time = found[0].match(/\d{1,2}:\d{2}$/)?.[0];
        if (time && HHMM.test(time)) return time;
    }
    return null;
}

export function currentNarrativeDateLine(text) {
    const clean = String(text || '').replace(HTML_COMMENT_RE, '').replace(/```[\s\S]*?```/g, '');
    for (const line of clean.split(/\n/).reverse()) {
        const start = line.trim();
        if (/^(?:сейчас|сегодня|на\s+календаре|текущая\s+дата|сюжетная\s+дата|дата\s+в\s+(?:истории|ролевой)|currently|today(?:\s+is)?|current\s+(?:story\s+)?date)\b/iu.test(start)
            && /(?:\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[.\/-]\d{1,2}(?:[.\/-]\d{2,4})?\b|\b\d{1,2}\s+[а-яa-z]{3,}\s+\d{4}\b)/iu.test(start)) return start;
    }
    return '';
}

export function currentCalendarDateLine(text) {
    const clean = String(text || '').replace(HTML_COMMENT_RE, '');
    // Only an explicitly labelled current date, not the date of a holiday,
    // reminder, plan or future event. Can be combined with a time on the line.
    const lines = clean.split(/\n/);
    return lines.find(line => /(?:текущ(?:ая|ие|ую)\s+дат[ауы]|сегодняшн(?:яя|юю)\s+дат[ауы]|дата\s+(?:сейчас|сцены|ролевой|истории)|current\s+(?:story\s+|rp\s+)?date|today(?:'s)?\s+date|сюжетная\s+дата|ролев(?:ая|ую)\s+дат[ауы])/iu.test(line)) || '';
}
