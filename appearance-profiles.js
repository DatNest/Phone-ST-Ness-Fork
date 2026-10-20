// Ness' Phone-ST fork: chat-scoped appearance and portable visual profiles.
// Game content (contacts, accounts, conversations) is deliberately excluded.
import { getSettings, getMeta, saveMeta } from './state.js';
import { saveSettingsDebounced } from '../../../../script.js';
import { PHONE_APPS } from './phone-apps.js';

export const PROFILE_MARKER = 'glassphone-appearance-profile';
export const APPEARANCE_KEYS = ['skin','themeCustom','wallpaper','wallpaperBlur','customCss','homeLayout','lockAppearance','lockScreen','messageAppearance','appIcons','toastStyle','toastPosition'];
const iconIds = new Set(PHONE_APPS.map(app => app.id));
const copy = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const imageSrc = v => typeof v === 'string' && v.length <= 4_000_000 && (/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(v) || /^https?:\/\/[^\s<>"']+$/i.test(v) || /^\/(?!\/)[^\s<>"']+/.test(v) || /^user\/images\/[^\s<>"']+/.test(v));

export function perChatAppearanceEnabled(){return getSettings().appearancePerChat !== false;}
export function snapshotAppearance(settings = getSettings()) {
    const result = {};
    for (const key of APPEARANCE_KEYS) if (settings[key] !== undefined) result[key] = copy(settings[key]);
    if (!plain(result.appIcons)) result.appIcons = {};
    return result;
}
export function appearanceSettings(){
    if (!perChatAppearanceEnabled()) return getSettings();
    const meta = getMeta();
    if (!plain(meta.appearanceProfile)) {
        meta.appearanceProfile = snapshotAppearance();
        saveMeta();
    }
    return meta.appearanceProfile;
}
export function saveAppearance(){
    if (perChatAppearanceEnabled()) saveMeta();
    else saveSettingsDebounced();
}
export function setPerChatAppearance(enabled){
    const settings = getSettings();
    // Switching global -> per-chat: copy current global design if needed.
    if (enabled && !plain(getMeta().appearanceProfile)) {
        getMeta().appearanceProfile = snapshotAppearance(settings);
        saveMeta();
    }
    settings.appearancePerChat = !!enabled;
    saveSettingsDebounced();
}
export function setAppearance(appearance){
    if (perChatAppearanceEnabled()) {
        getMeta().appearanceProfile = appearance;
        saveMeta();
    } else {
        const settings = getSettings();
        for (const key of APPEARANCE_KEYS) delete settings[key];
        Object.assign(settings, appearance);
        saveSettingsDebounced();
    }
}
export function cleanedAppearance(input){
    if (!plain(input)) throw Error('Неверный формат оформления');
    const clean = snapshotAppearance();
    if (typeof input.skin === 'string' && /^[a-z0-9_-]{1,24}$/i.test(input.skin)) clean.skin = input.skin;
    if (plain(input.themeCustom)) {
        const keys = ['accentA','accentB','bg','text','iconA','iconB','font','radius','transparency','iconScale'];
        clean.themeCustom = {};
        for (const key of keys) {
            const v = input.themeCustom[key];
            if (v === null || (typeof v === 'string' && v.length <= 50) || (typeof v === 'number' && Number.isFinite(v))) clean.themeCustom[key] = v;
        }
    }
    if (typeof input.wallpaper === 'string' && (!input.wallpaper || imageSrc(input.wallpaper))) clean.wallpaper = input.wallpaper;
    clean.wallpaperBlur = !!input.wallpaperBlur;
    if (typeof input.lockScreen === 'boolean') clean.lockScreen = input.lockScreen;
    if (typeof input.customCss === 'string') clean.customCss = input.customCss.slice(0, 100000);
    if (plain(input.homeLayout)) {
        // Layout is normalized by home-layout.js on rendering, with an upper bound on input size.
        const encoded = JSON.stringify(input.homeLayout);
        if (encoded.length > 3_000_000) throw Error('Слишком большой макет главного экрана');
        clean.homeLayout = copy(input.homeLayout);
    }
    if (plain(input.lockAppearance)) {
        const locked = copy(input.lockAppearance);
        if (typeof locked.image === 'string' && locked.image && !imageSrc(locked.image)) locked.image = '';
        clean.lockAppearance = locked;
    }
    if (plain(input.messageAppearance)) clean.messageAppearance = copy(input.messageAppearance);
    clean.appIcons = {};
    if (plain(input.appIcons)) for (const [id, src] of Object.entries(input.appIcons)) {
        if (iconIds.has(id) && imageSrc(src)) clean.appIcons[id] = src;
    }
    if (typeof input.toastStyle === 'string' && input.toastStyle.length < 32) clean.toastStyle = input.toastStyle;
    if (['top','center','bottom'].includes(input.toastPosition)) clean.toastPosition = input.toastPosition;
    return clean;
}

async function inlineLocalImage(url){
    if (!url || url.startsWith('data:')) return url;
    // Only local assets can be embedded reliably; leave remote URLs in place.
    try {
        const target = new URL(url, location.href);
        if (target.origin !== location.origin) return url;
        const result = await fetch(target.href, {credentials:'same-origin'});
        if (!result.ok) return url;
        const blob = await result.blob();
        if (!/^image\/(png|jpeg|webp)$/i.test(blob.type) || blob.size > 4_000_000) return url;
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();reader.onload = () => resolve(reader.result);reader.onerror = reject;reader.readAsDataURL(blob);
        });
    } catch {return url;}
}
export async function exportAppearance(name){
    const value = snapshotAppearance(appearanceSettings());
    value.wallpaper = await inlineLocalImage(value.wallpaper);
    if (value.lockAppearance?.image) value.lockAppearance.image = await inlineLocalImage(value.lockAppearance.image);
    if (Array.isArray(value.homeLayout?.widgets)) {
        for (const widget of value.homeLayout.widgets) if (widget.type === 'image' && widget.image) widget.image = await inlineLocalImage(widget.image);
    }
    if (value.appIcons) for (const key of Object.keys(value.appIcons)) value.appIcons[key] = await inlineLocalImage(value.appIcons[key]);
    const payload = {type:PROFILE_MARKER,version:1,name:String(name||'Моё оформление').slice(0,80),appearance:value};
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href=url;anchor.download='glassphone-theme-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export async function importAppearance(file){
    if (!file || file.size > 12_000_000) throw Error('Файл оформления слишком большой (максимум 12 МБ)');
    const raw = JSON.parse(await file.text());
    if (raw?.type !== PROFILE_MARKER || raw.version !== 1) throw Error('Это не файл оформления GlassPhone');
    setAppearance(cleanedAppearance(raw.appearance));
    return String(raw.name||'').slice(0,80);
}
export async function iconFromFile(file){
    if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 8_000_000) throw Error('Выбери PNG, JPG или WebP размером до 8 МБ');
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
        const canvas=document.createElement('canvas'),size=160;
        canvas.width=size;canvas.height=size;
        const ctx=canvas.getContext('2d');
        const scale=Math.min(size/img.naturalWidth,size/img.naturalHeight);
        const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
        ctx.clearRect(0,0,size,size);
        ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
        return canvas.toDataURL('image/png'); // Preserves alpha channel.
    } finally { URL.revokeObjectURL(url); }
}
export function applyHomeIconImages(screen){
    const icons = appearanceSettings().appIcons || {};
    for (const tile of screen.querySelectorAll('.gp-home .gp-app[data-app]')) {
        const id = ['socialhub','storyevent'].includes(tile.dataset.app) ? 'events' : tile.dataset.app;
        const src = icons[id];
        if (!src || !imageSrc(src)) continue;
        const surface = tile.querySelector('.gp-app-icon');
        if (!surface) continue;
        const img=document.createElement('img');
        img.className='gp-icon-art';img.src=src;img.alt='';img.setAttribute('aria-hidden','true');
        surface.classList.add('gp-custom-icon-image');
        surface.prepend(img);
    }
}
