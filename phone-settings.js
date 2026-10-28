import { lang } from './i18n.js';
import { getMeta, getRpDateTime } from './state.js';
const L=(ru,en)=>lang()==='en'?en:ru;
const I=n=>'<i class="fa-solid '+n+'" aria-hidden="true"></i>';
let panel=null;
function storage(){
    let node=document.getElementById('gp-settings-storage');
    if(!node){node=document.createElement('div');node.id='gp-settings-storage';node.hidden=true;document.body.appendChild(node);}
    return node;
}
// Keep one set of bound controls alive between screens, including file pickers and drafts.
export function registerPhoneSettings(node){panel=node;storage().appendChild(node);}
export function parkPhoneSettings(){
    if(!panel||panel.parentElement===storage())return;
    if(panel.contains(document.activeElement))document.activeElement.blur();
    storage().appendChild(panel);
}
function refreshClockControls(){
    if(!panel)return;
    const meta=getMeta(),mode=panel.querySelector('#gp-set-story-clock-mode'),date=panel.querySelector('#gp-set-story-date'),time=panel.querySelector('#gp-set-story-time'),status=panel.querySelector('#gp-story-clock-status');
    if(!mode)return;
    const manual=meta.storyClockManual||{};
    mode.value=meta.storyClockMode==='manual'?'manual':'auto';
    if(date)date.value=manual.year?`${String(manual.year).padStart(4,'0')}-${String(manual.month).padStart(2,'0')}-${String(manual.day).padStart(2,'0')}`:'';
    if(time)time.value=manual.hours!==undefined?`${String(manual.hours).padStart(2,'0')}:${String(manual.minutes||0).padStart(2,'0')}`:'';
    if(status){const dt=getRpDateTime();status.textContent=dt?`Сейчас: ${String(dt.day).padStart(2,'0')}.${String(dt.month).padStart(2,'0')}.${dt.year}${dt.hours===undefined?'':` ${String(dt.hours).padStart(2,'0')}:${String(dt.minutes).padStart(2,'0')}`}`:'Сюжетная дата пока не найдена';}
}
export function renderPhoneSettings(screen,api){
    const mounted=screen.querySelector('.gp-phone-settings-mount');
    if(mounted){if(panel&&panel.parentElement!==mounted)mounted.appendChild(panel);const check=panel?.querySelector('#gp-set-narrator');if(check)check.checked=!!getMeta().narratorMode;refreshClockControls();return;}
    parkPhoneSettings();
    screen.innerHTML='<header class="gp-header"><button type="button" class="gp-iconbtn" id="gp-settings-back" aria-label="'+L('На главный экран','Home')+'">'+I('fa-chevron-left')+'</button><h2>'+L('Настройки','Settings')+'</h2><span class="gp-settings-header-space"></span></header>'+
        '<div class="gp-phone-settings"><div class="gp-phone-settings-links">'+
        [['appstore','fa-store',L('App Store','App Store'),L('Установить и удалить приложения','Install and remove apps')],['appearance','fa-palette',L('Оформление телефона','Phone appearance'),L('Тема, иконки и главный экран','Theme, icons and home screen')],['lock','fa-lock',L('Экран блокировки','Lock screen'),L('Часы, дата и отдельные обои','Clock, date and wallpaper')],['chats','fa-comments',L('Оформление переписок','Chat appearance'),L('Общий стандарт обоев и пузырей','Default wallpaper and bubbles')]].map(([id,icon,title,subtitle])=>'<button type="button" data-settings-open="'+id+'"><i class="fa-solid '+icon+'" aria-hidden="true"></i><span><b>'+title+'</b><small>'+subtitle+'</small></span>'+I('fa-chevron-right')+'</button>').join('')+
        '</div><div class="gp-phone-settings-mount"></div></div>';
    screen.querySelector('#gp-settings-back').onclick=api.home;
    screen.querySelector('[data-settings-open="appstore"]').onclick=api.appstore;
    screen.querySelector('[data-settings-open="appearance"]').onclick=api.appearance;
    screen.querySelector('[data-settings-open="lock"]').onclick=api.lock;
    screen.querySelector('[data-settings-open="chats"]').onclick=api.chats;
    if(panel)screen.querySelector('.gp-phone-settings-mount').appendChild(panel);
    const check=panel?.querySelector('#gp-set-narrator');if(check)check.checked=!!getMeta().narratorMode;
    refreshClockControls();
}

