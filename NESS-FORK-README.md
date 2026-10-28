# GlassPhone / Phone-ST — Ness fork

Основан на Phone-ST 2.53.1 (Delidgi1). Изменения в `appearance-profiles.js`, `ui.js`, `home-layout.js`, `lock-appearance.js`, `phone-notifications.js`, `state.js`, `index.js` и `style.css`.

## Новые функции

- **Оформление отдельно для каждого чата**, включено по умолчанию. Данные лежат в `chat_metadata.glassphone.appearanceProfile`. Отключается в приложении «Оформление».
- Внешний вид: тема, цвета, стиль стандартных SMS-пузырей, собственный CSS, обои рабочего стола и экрана блокировки, расположение иконок, папок и виджетов, пользовательские значки приложений.
- **Импорт/экспорт JSON-оформления** через кнопки в «Оформлении». При экспорте локальные фотографии по возможности включаются в JSON в виде data URL. Для изображений, загруженных по внешним URL, работоспособность на другой установке зависит от доступности ссылки. Собственные CSS могут содержать сторонние изображения и шрифты, которые в JSON не встраиваются.
- **Отдельные иконки**: выбор приложения → «Загрузить значок», PNG/JPG/WebP; прозрачность PNG сохраняется. Изображение уменьшается до 160×160. Папки и док тоже используют эти значки.
- Игровые данные (SMS, контакты, банковские операции и публикации) **не включаются** в экспортируемые профили и не изменяются при их импорте.

## Установка

**Сделайте резервную копию** чатов и старого расширения. Если Phone-ST уже установлен, НЕ запускайте оригинал одновременно с форком: оба используют глобальное имя хранилища `glassphone` и одинаковые UI ID. Удалите/отключите оригинал, распакуйте папку `Phone-ST-Ness-Fork` в `SillyTavern/public/scripts/extensions/third-party/`, затем перезапустите ST и очистите кэш страницы.

Этот ZIP — установка из папки (не установленный публичный GitHub-форк). При публикации в своём репозитории можно устанавливать через URL Git.

## Ограничения

Этот форк проверен статически (JavaScript-синтаксис и проверки структурных изменений), но не проходил интерактивного теста с запущенной SillyTavern. Отдельные настройки *подключения к модели*, режимы генерации, установленные приложения и глобальная библиотека коротких пресетов по-прежнему общие. Внешние URL CSS/картинок сохраняются как ссылки. Не импортируйте непроверенные CSS-пресеты от незнакомых авторов.

Лицензия исходного проекта сохранена в `LICENSE`.

## 2026-10-22: Owner autonomy fix

AI-generated Twitter replies, Twitter/Instagram feed posts, Instagram/OnlyFans comments, channel discussions, and Discord messages are rejected when their author matches the user persona or account handle. Manual user actions remain unchanged. Existing unwanted comments can be deleted in their threads; this change does not automatically remove history.


## Ness 2.54.0 — Narrrator RP / commenter avatars

* Fixed fork baseline: No Auto User. The user's own posts/comments remain manual-only.
* Per-chat narrator mode: **Settings → Model and context → Ролевая с нарратором**.
  - Rich narrator card description, scenario, voice examples, activated lorebook entries and RP history supply world and ensemble context.
  - Active Narrator card name is never treated as a social actor.
  - Explicit RP participants may be offered as cast, but a mention does not create a contact, phone number or shared knowledge.
  - Narrator roster remembers names inferred from publicly visible RP dialogue labels (max 45). Specific private app messages are excluded.
* Commenters in Twitter, Instagram and OnlyFans: tap or click their avatar to change it.
  - A per-account override persists across comments in the current chat.
  - Upload a photo, paste a direct HTTPS image URL, use another random internet image, or reset.
  - When no own/contact avatar exists, a stable portrait comes from i.pravatar.cc (internet required). If blocked/offline, initials remain.
  - This service uses generic stock portraits, not actual likenesses of roleplay characters. For established characters choose their own image.
* Old wallpaper, icons, custom CSS and social histories are not intentionally migrated/reset.
* Narrator mode affects text context and account selection; it does not rewrite narrator character cards.


## Ness 2.55.0 — editable social prompts / account profiles

* Twitter/Instagram feed avatars and comment avatars open the SAME editable social account profile. Instagram Story viewer and OnlyFans posts use the profile control too.
* Accounts store display name, handle, short bio, creator notes, avatar and a recurrence pin in per-chat metadata. This is NOT a phone contact and gives no private access.
* Stable avatars: account-level edits, external portrait/photo services and manual image upload or URL. Reuses existing avatar overrides from earlier versions where possible.
* A per-chat registry collects generated and previously visible accounts. Narrative cast/contact actors and people who interacted with the user's posts are pinned automatically; strangers recur once established, but should still be selected contextually.
* Settings > "Редактор промптов соцсетей" provides editable global and per-app rules, export/import JSON for any external text editor, and defaults reset. The extension enforces JSON output and blocks unwanted author impersonation separately from user-editable style instructions.
* New features are statically checked; full SillyTavern runtime / API behavior must be tested in the user's setup.

## Ness 2.56.0 — single roleplay-post clock (complete replacement)

There is exactly one authoritative clock reader: `getRpDateTime()` in `state.js`.
It reads the **RP chat posts**, using explicit current date/time statements or RP clock tags.
Date and time are independent: an unknown date remains blank, an unknown time shows `--:--`.
It DOES NOT read calendar injections, device clock, per-chat manual overrides, saved
last-known metadata, future appointments, SMS text or telephone activity logs.
Each opening of the phone and the "Обновить время и дату" button rescans RP posts.

Preferred unambiguous format in a roleplay post:

    Дата: 28.10.2026
    Время: 16:00

Or one existing supported explicit tag:

    [RP_DATE:28.10.2026 16:00]

If no explicit current-time evidence is in any RP post, no time is inferred.
The screenshot/home/lock screen, social captions, bank reminders and delivery progress
use the same clock. Real timestamps may still be used **internally** for sorting,
identifiers and throttling, never as a source of story time.

There is no longer a manual clock mode, calendar fallback, or saved last-known clock.
Old persisted settings and user data are not deleted; the removed clock overrides
are simply ignored. No personal chat/SMS/social/avatar/theme data is reset.

The previous No Auto User safeguard, narrator mode, avatar editing and social prompt
editor remain part of this complete extension build. Syntax and isolated clock
regression checks are performed; this is not a full browser integration test.
