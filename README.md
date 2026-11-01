# Phone-ST-Ness-Fork
## Ness v2.58.1 — universal RP SMS previews (built on v2.58.0)

- **One existing scanner and one SMS/contact store** recognize prose, quoted
  text, Markdown blockquotes, time/sender headers, emoji-decorated names,
  multi-line notifications, and explicitly labelled sender/recipient/text fields.
- Scans again whenever the phone is opened; no prompt injection, new account
  configuration, or message-writing by the model is required.
- A notification is imported only when the **player owns the relevant phone**
  or is the explicit recipient. Unrelated NPC conversations, ordinary quotes,
  drafts and text in code/thinking blocks are rejected.
- Canonical identity matching uses the existing contact registry; cosmetic
  emoji do not create duplicate contacts. A sender's time label is displayed
  on the SMS bubble without changing the current story clock.
- Preserves existing tags, interactions, RP history, read receipts, and the
  prior SMS styles. Limit: no deterministic parser can infer a recipient from
  truly ambiguous prose or an unlabeled snippet with no phone context.
- Tests: `node --test tests/rp-sms.test.mjs` and
  `node --experimental-vm-modules --test tests/state-formatted.mjs`

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
