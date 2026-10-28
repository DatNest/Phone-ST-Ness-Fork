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

## Ness 2.55.1 — Social AU authors & story clock diagnostic fix

* Strengthened model instructions so established AU characters can publish alongside unrelated local users; no requirement to be a personal phone contact. Characters are selected from the active story, not imported future canon.
* Narrator roster recognizes more common card formats (labelled role bullets and cast sections), while not blindly treating every capitalized place as a person.
* Story clock now receives an explicit priority header before lengthy card and lorebook context. If the in-story date cannot be parsed, generator is asked not to use device date as story canon.
* Newly generated X and Instagram entries save an optional `rpAt` timestamp alongside the original real timestamp. X/Instagram feed labels use RP elapsed time when a valid RP clock exists. Old posts continue using legacy real timestamps without migration.
* All previous account profiles, avatars, author safeguards and JSON-editable prompts stay intact.
* Limitations: if the in-story clock is absent or not parseable from recent RP posts / calendar injections, a prompt cannot reconstruct it reliably; calendar/roleplay time markers are still needed. Other apps' timestamps may still use real time. These changes are statically checked, not runtime-tested in the user's ST.

## Ness 2.55.2 — Guarded RP clock (SMS deadline fix)
- RP clock now accepts explicit present-tense clock references, RP_DATE tags and validated story-clock tags from actual RP messages, rather than interpreting any HH:MM in the last messages as current time.
- Outgoing SMS and incoming SMS-only ghost replies (including ones carrying an accidental clock tag) cannot silently advance the RP clock.
- Future appointments, curfews, proposed meeting times, calendar-plan deadlines and phone journal entries remain content, not story-clock updates.
- Calendar injections must explicitly identify CURRENT date/time; GlassPhone's own injected prompt is excluded from calendar source discovery.
- The standalone parseAnyDateTime helper remains unchanged for interpreting real appointments and calendar plans.
- No phone metadata, contacts, posts, avatars or prompt overrides are reset by this patch.

## Ness 2.55.3 — Strict per-chat RP date (no real-clock fallback)
- A date/time recognized from the RP or calendar is saved as a per-chat last-known snapshot; a temporary missing injection does not replace it with the device clock.
- A time-only anchor without a known RP date no longer fabricates the date from new Date().
- When no RP clock exists, phone home/lock clock shows `--:--` and date shows `Дата сюжета не установлена`, not device time.
- Settings → Model and context now allows setting a manual YYYY-MM-DD HH:MM clock for the CURRENT chat; automatic mode remains the default.
- Manual clock takes precedence until Auto is chosen again. The setting is per-chat; other chats retain their separate values.
- Russian present-date parsing is fixed, and the cache signature now includes the chat identity.
- Internal operational timestamps (file IDs, timeouts, update ordering) continue to use real time; this patch is about RP date display and source selection.
- Previous No Auto User / accounts / images / social prompt editor are unchanged.

## Ness 2.55.4 — Refresh story clock on every open
- Every opening of the phone invalidates the detected clock cache and scans the active RP chat/calendar again **before** the screen renders, without needing a page reload.
- Settings → Model and context → Story date/time: added **«Обновить время и дату»** to recheck sources on demand.
- When sources provide no current clock, keeps this chat's last-known RP timestamp instead of using device time; settings explicitly labels the cached value.
- Manual clock remains fixed until the user selects automatic mode. Refreshing does not silently override manual time.
- SMS deadlines remain excluded from current-time detection by the existing guarded parser. No saved posts, prompts, or appearance settings are modified.
