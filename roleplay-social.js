// Read-only interpretation of social-media evidence already established in RP posts.
// No model calls, generated stories or changes to chat messages. Used by the
// existing X/Instagram and channel harvesters; they remain the only stores.
const POSTS = /(?:\bpost(?:ed|ing|s)?\b|\btweet(?:ed|s)?\b|\btwitter\b|\binstagram\b|\binsta\b|\breddit\b|\bsocial\s+media\b|\bnews\b|\bchannel\b|\bfeed\b|\bX\b|инстаграм[\p{L}]*|твит[\p{L}]*|соцсет[\p{L}]*|(?<![\p{L}\p{N}])пост(?:а|е|ом|у|ы|ов)?(?![\p{L}\p{N}])|лент[\p{L}]*|новост[\p{L}]*|канал[\p{L}]*|паблик[\p{L}]*|газет[\p{L}]*|стать[\p{L}]*|репортаж[\p{L}]*|телеграм[\p{L}]*)/iu;
const ACTION = /(?:опубликова[\p{L}]*|запост[\p{L}]*|постил[\p{L}]*|вылож[\p{L}]*|размест[\p{L}]*|твитнул[\p{L}]*|написал[\p{L}]*|написала[\p{L}]*|подписал[\p{L}]*|загрузил[\p{L}]*|posted|published|uploaded|tweeted|shared|увидел[\p{L}]*|заметил[\p{L}]*|наткнул[\p{L}]*|листая|листала|прочитал[\p{L}]*|смотрел[\p{L}]*|показал[\p{L}]*|появил[\p{L}]*|вышла|вышел|сообщил[\p{L}]*|прочла|содержал[\p{L}]*|reported|saw|read|found|showed)/iu;
const VIEWED = /(?:увидел[\p{L}]*|наткнул[\p{L}]*|прочитал[\p{L}]*|прочла|заметил[\p{L}]*|показал[\p{L}]*|смотрел[\p{L}]*|листая|листала|saw|read|found|showed)/iu;
const POSTED = /(?:опубликова[\p{L}]*|запост[\p{L}]*|постил[\p{L}]*|вылож[\p{L}]*|размест[\p{L}]*|твитнул[\p{L}]*|написал[\p{L}]*|написала[\p{L}]*|подписал[\p{L}]*|posted|published|uploaded|tweeted|shared|сообщил[\p{L}]*|вышла|вышел)/iu;
const NOT_POSTED = /(?:не\s+(?:запостил[\p{L}]*|опубликова[\p{L}]*|вылож[\p{L}]*|публикова[\p{L}]*|отправил[\p{L}]*)|черновик|собирал[\p{L}]*\s+(?:запостить|опубликовать|выложить)|хотел[\p{L}]*\s+(?:запостить|выложить|опубликовать)|передумал[\p{L}]*|неопубликованн[\p{L}]*|draft|never\s+posted|did\s+not\s+post)/iu;
const SMS = /(?:\bSMS\b|\bDM\b|смс|личн[\p{L}]*\s+сообщени[\p{L}]*|переписк[\p{L}]*|мессенджер[\p{L}]*)/iu;
const QUOTE = /«([^»\n]{3,1200})»|“([^”\n]{3,1200})”|"([^"\n]{3,1200})"/gu;
const NARRATOR = /^(?:narrator|нарратор|рассказчик|повествователь|assistant|system)$/iu;
const CLEAN_TAGS = /<!--\s*tel:[\s\S]*?-->|<!--\s*HT\b[\s\S]*?-->|<think>[\s\S]*?<\/think>/giu;
const NAME = String.raw`[\p{Lu}][\p{L}’'.-]{1,35}(?:\s+[\p{Lu}][\p{L}’'.-]{1,35}){0,2}`;
const NAME_REG = new RegExp(NAME, 'gu');
const clean = value => String(value || '').normalize('NFKC').replace(/\s+/gu,' ').trim();
const key = value => clean(value).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/^@/, '');
const first = value => key(value).split(' ')[0];
const firstForms = value => {
    const v=first(value), forms=new Set([v]);
    if (!/^[а-яё]+$/iu.test(v)||v.length<4)return forms;
    const last=v.at(-1), root=v.slice(0,-1);
    if(last==='а')for(const tail of ['ы','и','е','у','ой','ей'])forms.add(root+tail);
    else if(last==='я')for(const tail of ['и','е','ю','ей'])forms.add(root+tail);
    else if(last==='ь'||last==='й')for(const tail of ['я','ю','ем','е','и'])forms.add(root+tail);
    else if(/[бвгджзклмнпрстфхцчшщ]/u.test(last))for(const tail of ['а','у','ом','е'])forms.add(v+tail);
    return forms;
};
const isUser = (value, opts) => !!value && (opts.userNames || []).some(u => key(value)===key(u) || key(value)===first(u));

export function normalizeSocialText(value) {
    return key(value).replace(/https?:\/\/\S+/gu,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
export function sameSocialPost(a, b) {
    const aText=normalizeSocialText(a), bText=normalizeSocialText(b);
    if (!aText || !bText) return false;
    if (aText===bText) return true;
    const x=new Set(aText.split(' ').filter(Boolean)), y=new Set(bText.split(' ').filter(Boolean));
    if (Math.min(x.size,y.size)<4) return false;
    const common=[...x].filter(w=>y.has(w)).length;
    const union=new Set([...x,...y]).size;
    return common/union >= 0.76 || (common/Math.min(x.size,y.size)>=0.90 && common/Math.max(x.size,y.size)>=0.72);
}
// A short first name is accepted only if it uniquely matches a roster entry.
function actor(raw, opts) {
    const name=clean(raw).replace(/[.,:;!?]+$/u,'');
    if (!name || NARRATOR.test(name)) return '';
    if (name[0]==='@') return name.slice(0,65);
    const choices=[...new Set([...(opts.knownActors||[]), ...(opts.userNames||[])].map(clean).filter(Boolean))];
    const exact=choices.filter(v=>key(v)===key(name));
    if (exact.length===1) return exact[0];
    const byFirst=choices.filter(v=>first(v)===key(name));
    if (byFirst.length===1) return byFirst[0];
    if (byFirst.length>1) return '';
    const declined=choices.filter(v=>firstForms(v).has(key(name)));
    if(declined.length===1)return declined[0];
    if(declined.length>1)return '';
    if (/^[\p{Lu}][\p{L}’'.-]{1,35}(?:\s+[\p{Lu}][\p{L}’'.-]{1,35}){0,2}$/u.test(name) && !/^(?:он|она|они|это|в|на|к|из|пост|лента|телеграм|инстаграм|сегодня|новости|газета|пользователь)$/iu.test(name)) return name;
    return '';
}
function knownMatch(part, opts, last=false) {
    const actors=[...new Set([...(opts.knownActors||[]),...(opts.userNames||[])].map(clean).filter(Boolean))];
    const hits=[];
    // First and full names are recognized by word boundaries, never inside another word.
    for(const name of actors) for(const alias of [name, name.split(' ')[0]]){
        if(alias.length < 3) continue;
        const e=alias.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
        for(const m of part.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${e}(?![\\p{L}\\p{N}])`,'giu'))) hits.push({name,pos:m.index,len:alias.length});
    }
    if(!hits.length) return '';
    hits.sort((a,b)=>last? b.pos-a.pos||b.len-a.len : a.pos-b.pos||b.len-a.len);
    const at=hits[0].pos, matches=[...new Set(hits.filter(h=>h.pos===at).map(h=>h.name))];
    if(matches.length===1)return matches[0];
    const full=matches.filter(n=>key(n)===key(part.slice(at,at+n.length)));
    return full.length===1?full[0]:'';
}
function authorFromSeen(pre,opts){
    const after=pre.match(/(?:пост[\p{L}]*|твит[\p{L}]*|публикаци[\p{L}]*|новост[\p{L}]*|стать[\p{L}]*|репортаж[\p{L}]*)\s+(?:от\s+|пользователя\s+|автора\s+)?(@[\w.]{2,50})/iu);
    if(after)return after[1];
    // Phrase: увидел пост NAME / saw NAME's post
    const match=pre.match(/(?:пост[\p{L}]*|твит[\p{L}]*|публикаци[\p{L}]*)\s+(?:от\s+|автора\s+|пользователя\s+)?([^:,.!?]{2,90}?)(?:\s+в\s+(?:X|Twitter|Инстаграм[\p{L}]*|Instagram))?\s*:?\s*$/iu);
    if(match) {
        const candidate=knownMatch(match[1],opts) || actor(match[1].trim(),opts);
        if(candidate) return candidate;
    }
    const english=pre.match(/\b([\p{Lu}][\p{L}’'.-]{2,35})['’]s\s+(?:post|tweet)\b/iu);
    return english?actor(english[1],opts):'';
}
function postedAuthor(pre, opts){
    const lastAction=[...pre.matchAll(new RegExp(POSTED.source,'giu'))].at(-1);
    if(!lastAction)return '';
    const before=pre.slice(Math.max(0,lastAction.index-130),lastAction.index);
    const known=knownMatch(before,opts,true);
    if(known)return known;
    const raw=before.match(new RegExp(`(${NAME})\\s*$`,'u'));
    if(raw)return actor(raw[1],opts);
    const after=pre.slice(lastAction.index+lastAction[0].length);
    const following=after.match(new RegExp(`^\\s+(${NAME})(?=\\s*(?:[:—,.]|\\b(?:в|на)\\b))`,'u'));
    if(following)return actor(following[1],opts);
    if(/(?:^|\s)(?:я|i)\s*$/iu.test(before)) {
        if(opts.isUserPost) return clean(opts.userNames?.[0]);
        if(opts.defaultAuthor&&!NARRATOR.test(opts.defaultAuthor))return opts.defaultAuthor;
    }
    // In a single-character card, third-person narration can refer to the
    // card's protagonist. Never apply this shortcut to a narrator ensemble.
    if(!opts.narratorMode && !opts.isUserPost && opts.defaultAuthor
        && !NARRATOR.test(opts.defaultAuthor)
        && /(?:^|\s)(?:он|она|he|she)\s*$/iu.test(before))return clean(opts.defaultAuthor);
    return '';
}
function publishedSource(pre){
    // Named news publisher, not the person reading the article.
    const named=pre.match(/(?:газет[\p{L}]*|сайт[\p{L}]*|издани[\p{L}]*|агентств[\p{L}]*|канал[\p{L}]*|паблик[\p{L}]*|редакци[\p{L}]*|news\s+(?:outlet|site|channel))\s+[«"“]([^»"”]{2,70})[»"”]/iu);
    if(named)return clean(named[1]);
    const plain=pre.match(new RegExp(`(?:газет\\w*|издани\\w*|редакци\\w*|канал\\w*|паблик\\w*)\\s+(${NAME})`,'iu'));
    return plain?clean(plain[1]):'';
}
function sourcePlatform(pre) {
    if(/(?:\binstagram\b|\binsta\b|инстаграм[\p{L}]*|сторис|stories)/iu.test(pre))return 'instagram';
    if(/(?:\btwitter\b|\btweet\w*\b|\bX\b|твит[\p{L}]*|твиттер[\p{L}]*)/iu.test(pre))return 'twitter';
    if(/(?:новост[\p{L}]*|газет[\p{L}]*|издани[\p{L}]*|агентств[\p{L}]*|редакци[\p{L}]*|\bnews\b|репортаж[\p{L}]*|канал[\p{L}]*|паблик[\p{L}]*|телеграм[\p{L}]*)/iu.test(pre))return 'channel';
    return /(?:фото|фотографи[\p{L}]*|снимок|picture|photo)/iu.test(pre)?'instagram':'twitter';
}
function getPhoto(pre) {
    const m=pre.match(/(?:фото(?:графи[\p{L}]*)?|снимок|picture|photo)\s+(?:с|где|на\s+котором|того[,]?\s+как)\s+([^:«»]{5,220})/iu);
    return m?clean(m[1]).slice(0,250):'';
}
export function extractNarrativeSocial(message, opts={}) {
    if(!message || message.is_system || !message.mes)return [];
    const text=String(opts.text??message.mes).replace(CLEAN_TAGS,'');
    if(!POSTS.test(text)||!ACTION.test(text))return [];
    const events=[];
    for(const paragraph of text.split(/\n{2,}/u)) {
        if(!POSTS.test(paragraph)||!ACTION.test(paragraph))continue;
        QUOTE.lastIndex=0;
        let quotedEvents=0;
        for(const match of paragraph.matchAll(QUOTE)){
            const quote=clean(match[1]||match[2]||match[3]);
            if(quote.length<7)continue;
            const before=paragraph.slice(Math.max(0,match.index-360),match.index);
            // Every record needs a clear social/news reference and an actual
            // posting/viewing action in the SAME preceding clause.
            if(!POSTS.test(before)||!ACTION.test(before)||NOT_POSTED.test(before))continue;
            if(SMS.test(before) && !/(?:соцсет|инстаграм|твит|twitter|instagram|\bX\b|новост|пост\b|канал)/iu.test(before))continue;
            // Do not parse chatter quoting a future/intended post as publication.
            if(/(?:если|якобы|возможно|мог\s+бы|планировал[\p{L}]*|предложил[\p{L}]*|хотел[\p{L}]*|would\s+post)\s+[^.!?]{0,100}$/iu.test(before))continue;
            const platform=sourcePlatform(before);
            const viewed=VIEWED.test(before) && !/(?:опубликова[\p{L}]*|запост[\p{L}]*|вылож[\p{L}]*|размест[\p{L}]*)/iu.test(before.slice(-140));
            let author='';
            if(platform==='channel')author=publishedSource(before);
            if(!author&&viewed)author=authorFromSeen(before,opts);
            if(!author&&!viewed)author=postedAuthor(before,opts);
            if(!author)continue; // no invented accounts/news publishers
            if(isUser(author,opts) && !opts.isUserPost)continue;
            if(NARRATOR.test(author))continue;
            if(events.some(e=>e.platform===platform && key(e.author)===key(author)&&sameSocialPost(e.text,quote)))continue;
            events.push({platform,author,text:quote,photo:platform==='instagram'?getPhoto(before):'',source:'rp-prose',quoteIndex:events.length});
            quotedEvents++;
        }
        // Quoted text is preferable. Without a quote, accept ONLY something
        // actually described: a captionless photo or a sourced news fact.
        // A bare "someone saw a funny post" never becomes made-up content.
        if(quotedEvents || NOT_POSTED.test(paragraph))continue;
        const platform=sourcePlatform(paragraph);
        if(platform==='instagram' && POSTED.test(paragraph)){
            const author=postedAuthor(paragraph,opts), photo=getPhoto(paragraph);
            if(author && photo && (!isUser(author,opts)||opts.isUserPost)) {
                events.push({platform,author,text:'',photo,source:'rp-photo-description',quoteIndex:events.length});
            }
        } else if(platform==='channel' && POSTED.test(paragraph)){
            const author=publishedSource(paragraph);
            const statement=paragraph.match(/(?:[,—:]\s*)?что\s+([^\n]{15,350})$/iu);
            const summary=clean(statement?.[1]||'').replace(/[.\s]+$/u,'');
            if(author && summary && !NOT_POSTED.test(summary)) {
                events.push({platform,author,text:summary,photo:'',source:'rp-news-summary',quoteIndex:events.length});
            }
        }
    }
    return events.slice(0,10);
}
