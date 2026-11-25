# Phone-ST-Ness-Fork
## Ness v2.58.0 — RP SMS ↔ phone synchronization

- On **every phone open**, rescan saved roleplay posts (including narrator cards)
  for explicitly sent or received text messages. No new model requests or
  injections into the RP context are required.
- Both directions use the existing unified contact/SMS store: an NPC texting
  the player appears **incoming**, a user-authored RP post texting an NPC
  appears **outgoing**. NPC-to-NPC messages remain private.
- Recognizes quoted SMS, simple text after a colon, nearby named recipients,
  and a limited previous-RP-turn phone conversation. Ambiguous situations,
  unsent drafts, voice dialogue, and text within `<think>`/code blocks are
  deliberately ignored.
- Preserves explicit `tel:sms`/`tel:out` tags without duplicating them. RP text
  is not rewritten. Reactions/hiding for inferred SMS live in chat metadata;
  source RP posts are never deleted by phone UI actions.
- No invented phone numbers, manual new-account registration, or messages
  authored on the user's behalf by a narrator.
- Automated source-only tests: `node --test tests/rp-sms.test.mjs`.


### RP → Social synchronisation (v2.59.0)

Opening the phone or receiving/editing RP messages re-scans **saved RP posts** for
confirmed social activity. In addition to existing `tel:tweet`, `tel:insta`,
`tel:chan` tags, explicitly published or seen posts can be recognized from
ordinary prose. X, Instagram and named news/channel sources share their
existing app data stores. Quoted content is preferred; a concretely described
photo or an attributed news summary can also be imported. Vague references
with no identifiable author/source or content are skipped, not invented.

The same source post is only imported once, including after restarting or
re-opening the phone. Substantially similar content by the same author on the
same platform is suppressed. RP-established posts survive regular feed refresh;
AI-generated posts are also compared against existing ones.

Phone contacts and RP SMS still use the canonical identity/thread store;
confirmed prose SMS and `tel:sms` duplicates are reconciled. The player is not
made to post by narrator-authored text. No main-chat prompt injection is
required. This parser does not automatically draw images from descriptions.

### Ness 2.60.0-ness.18 — on-demand AI story clock

The phone reads the latest five RP posts and available external HTML metadata only on opening after a content change. Manual refresh reads eight posts. Cached results (including unknown date/time) live in chat metadata. Edits/swipes invalidate the signature; switching chats or closing discards pending responses. No background clock requests. Choose an optional clock connection profile or inherit the phone profile. Historical per-message SMS timestamp tags remain independent. Transport cancellation depends on the selected provider.

### Ness 2.60.0-ness.19 — clock transport fix

Clock uses the existing phone generation transport, inherits the phone connection or a selected clock profile, bypasses social prefill and low output caps, and uses a 2048-token ceiling (including provider reasoning) with a single compact line response. Empty and incomplete responses get explicit errors. No automatic retries or new request triggers.
