// Editable from phone settings, exportable as standalone JSON.
// Suggestions are additive: structured JSON schema and strict user-author checks remain enforced by code.
export const PHONE_SOCIAL_PROMPT_DEFAULTS = Object.freeze({
  global: `Write as believable independent people in a living social world, not as one narrator. Use specific, mundane details from the established setting. No generic moral-of-the-story lines, forced sentimentality or formulaic social-media aphorisms. Distinct voices, realistic imperfect casual language, grounded knowledge. Do not force all posts to mention the player or the same current plot.`,
  twitterFeed: `Every account should have a believable personal focus: daily life, hobbies, work, humor, news, neighborhood drama, disagreements or observations. Mix ordinary posts with occasional plot-relevant material. Make most tweets genuinely short (one or two sentences). Avoid grand philosophical conclusions or repeated rhetorical structures.`,
  twitterComments: `Replies address something SPECIFIC in the parent post. Some are brief, awkward, offhand, funny, contrary or practical. Avoid five people agreeing politely or speaking as one corporate PR department. Do not make every reply an exposition dump.`,
  instagramFeed: `Instagram content feels like actual personal photos, photo dumps, snapshots and niche accounts. Captions vary from one-word captions to longer notes; reflect each author's lifestyle and personality.`,
  instagramComments: `Comments react to the actual posted picture/caption, not a generic compliment. Vary length and tone; allow brief replies and private in-jokes only when grounded.`,
  channels: `Channel discussions sound like real online communities: topic-specific, varied voices, brief exchanges, occasional disagreement and inside knowledge only where justified.`,
  other: `Write socially plausible, grounded content with distinct identities and realistic pacing.`
});
export function socialPromptExtras(settings, kind) {
  const map = settings?.socialPromptOverrides && typeof settings.socialPromptOverrides==='object' ? settings.socialPromptOverrides : {};
  const global = Object.hasOwn(map, 'global') ? map.global : PHONE_SOCIAL_PROMPT_DEFAULTS.global;
  const specific = Object.hasOwn(map, kind) ? map[kind] : (PHONE_SOCIAL_PROMPT_DEFAULTS[kind] || PHONE_SOCIAL_PROMPT_DEFAULTS.other);
  return [global, specific].map(x=>String(x||'').trim()).filter(Boolean).join('\n');
}
export function normalizedSocialPrompts(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Expected JSON object with prompt fields');
  const result={};
  for(const key of Object.keys(PHONE_SOCIAL_PROMPT_DEFAULTS)) {
    if(Object.hasOwn(raw,key)) {
      if(typeof raw[key]!=='string'||raw[key].length>12000)throw new Error('Invalid prompt field: '+key);
      result[key]=raw[key];
    }
  }
  return result;
}
