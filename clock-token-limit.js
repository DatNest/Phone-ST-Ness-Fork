// Resolve only the response budget, not the prompt or sampling settings.
// Connection Manager profiles reference a completion preset by name.
export function resolveClockTokenLimit(ctx, profileId, amountGen) {
    const positive = value => {
        const n=Number(value);
        return Number.isFinite(n)&&n>=1?Math.trunc(n):null;
    };
    const profile=profileId ? (ctx?.extensionSettings?.connectionManager?.profiles||[]).find(p=>p.id===profileId) : null;
    if(profileId&&!profile)throw new Error('Профиль подключения не найден: '+profileId);
    const api=profile ? ctx?.CONNECT_API_MAP?.[profile.api]?.selected : ctx?.mainApi;
    const type=api==='openai'?'openai':'textgenerationwebui';
    const presetName=profile?.preset;
    if(presetName){
        const preset=ctx?.getPresetManager?.(type)?.getCompletionPresetByName?.(presetName);
        const n=positive(type==='openai'?preset?.openai_max_tokens:preset?.genamt);
        if(n!==null)return n;
    }
    // No preset (or legacy preset without a budget): use ST's live generation setting.
    const active=positive(type==='openai'?ctx?.chatCompletionSettings?.openai_max_tokens:amountGen);
    if(active!==null)return active;
    throw new Error('Не удалось прочитать лимит ответа из настроек подключения SillyTavern.');
}
