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
- Recommendation regression fixture: a player overlay, related-event list and
  its same-origin iframe contain competing dates/times before the actual event.
  The real DOM capture excludes all three subtrees. The browser result is
  `date: 2026-06-14`, `time: 16:00`, `recommendationLeaked: false`,
  `hiddenOrSecretLeaked: false`, `sends: 0`. Visible main-content iframes and the
  700 ms delayed-body scenario were also rechecked after this filter change.

The fixture is only a local test page, not an installed-extension end-to-end
test. It does not exercise Chrome activeTab permission or a deployed API.

## Real-browser observations and remaining gates

- On 2026-09-25 the user enabled the current 0.1.1 unpacked extension and disabled
  the old duplicate. The installed extension was tested in normal logged-in
  Chrome on the supplied Comein page.
- The first new-version capture fixed the title/platform/start time, but selected
  a date from the replay player's recommendation overlay. Capture now excludes
  player, recommendation and related-event subtrees from text, title candidates
  and iframe traversal. This is a generic DOM filter, not a Comein URL rule.
- After reopening the extension popup, the same real page produced the correct
  source heading and organizer, platform `进门财经`, date `2026-06-14`, start
  `16:00`, and an empty end time. The real title and body are not copied here.
- Clicking `发送到 ZhiNote` opened `zhi-note.com/schedule`. Its input contained
  the reviewed envelope with matching fields and displayed the green
  extension-received notice. This validates the installed capture, background
  storage delivery, handshake and deployed-app autofill together.
- The initial production deployment of `f00d4a3` failed during dependency install:
  pnpm 11 no longer recognizes `ignoredBuiltDependencies`. Separate commit
  `955d158` migrates the two existing denials to `allowBuilds: false`, preserving
  the script restrictions without changing dependency versions.
- Production deployment `8XmRavPkFShYkgb5XT16G5rZsHEL` for `955d158` is Ready,
  verified in the authenticated Chrome Vercel dashboard and GitHub status.
  The Vercel connector itself needed reauthentication, so it was not used as
  deployment evidence.
- A synthetic, non-writing POST to the real `zhi-note.com/api/meetings/intake`
  returned HTTP 200 with edited topic/platform/end time and blank organizer
  preserved, `calendarWriteStatus: not_started` and
  `fetchedPageReadStatus: not_started`. A malformed reviewed envelope returned
  HTTP 400 with `meeting_intake_invalid_review`. This proves the matching API
  is live; it is not a calendar import or synchronization acceptance test.
- Final manual import and same-account cross-browser synchronization remain live
  acceptance gates. The populated ZhiHui input was left for the owner to review
  and import; the agent did not click the final import button.
- Same-origin iframe and waiting behavior are verified with synthetic fixtures;
  they have not been established as necessary for this particular Comein page.

For unknown platforms, only the source origin is retained because arbitrary
paths/query strings/fragments can contain tokens. Numeric Comein roadshow paths
are retained. Direct deep links on other platforms are not guaranteed.
