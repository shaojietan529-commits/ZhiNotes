# Meeting capture 0.1.1 verification

## Scope

The extension now uses a generated copy of the existing application parser.
Confirmed fields, including intentionally empty organizer/end time, survive
delivery without being re-inferred from old page text. Topic, date and start
time are required so the existing calendar cannot silently choose today.
The DOM event names, storage key and intake meeting response shape are unchanged.

No live page body, credentials, contact details or meeting passcodes are stored
in this report or test fixtures. The example below is entirely synthetic.

## Sanitized synthetic example

```text
页面网址：https://www.comein.cn/roadshow/home/123456
页面标题：[回放]示例证券｜行业展望与策略讨论
播放器 00:00 / 00:00
2026-06-14 16:00
```

Expected and verified result:

- Topic: 示例证券｜行业展望与策略讨论
- Organizer: 示例证券
- Platform: 进门财经
- Date: 2026-06-14
- Start: 16:00; end: empty

The source hostname outranks unrelated platform mentions. Explicit time labels
still have first priority, followed by clocks on dated lines, then the existing
fallback. The video timer does not become the meeting start time.

## Verification completed

- `node --test chrome-extension/review.test.mjs`: 12 behavioral tests, including
  generated-parser freshness, all edited fields, empty optional fields, invalid
  dates, overnight duration, privacy filtering, the actual intake route with
  network calls intercepted, and the background delivery bridge.
- `npm run verify:meeting-intake`: 66 existing synthetic date/time cases and
  13 route contract checks.
- `node chrome-extension/handshake.test.mjs`: both handshake load orders.
- `npm run verify:module-workspaces`, `npm run verify:meeting-import`,
  `npm run lint`, `npm run build`: passed.
- Normal Chrome with `review-fixture.html` and the real popup/parser code:
  main-content extraction, visible same-origin iframe, delayed content, empty
  shell rejection, editing, clearing organizer, selecting a different platform,
  Escape cancellation and dialog layout were checked. Hidden/secret/noise leak
  flags were false. The fixture sends to an in-page test receiver, not ZhiNote;
  no calendar or cloud data is written.

The fixture is only a local test page, not an installed-extension end-to-end
test. It does not exercise Chrome activeTab permission or a deployed API.

## Real-browser observations and remaining gates

- The supplied Comein page is accessible in normal Chrome. The installed old
  extension still selected a video playback clock rather than the meeting time.
- The new 0.1.1 unpacked directory must be reloaded in Chrome before repeating
  this real-page test. The app must also deploy the matching parser/API changes.
- Vercel connector authentication has expired; production deployment must be
  independently checked after the Git push. A successful build is not proof
  that `zhi-note.com` is serving the new version.
- ZhiHui autofill/green notice, final manual import and same-account cross-browser
  synchronization remain live acceptance gates. No automatic import was made.
- Same-origin iframe and waiting behavior are verified with synthetic fixtures;
  they have not been established as necessary for this particular Comein page.

For unknown platforms, only the source origin is retained because arbitrary
paths/query strings/fragments can contain tokens. Numeric Comein roadshow paths
are retained. Direct deep links on other platforms are not guaranteed.
