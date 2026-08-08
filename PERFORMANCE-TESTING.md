# Android performance testing

This is an opt-in diagnostic setup for the slow-interaction investigation. It
does not change navigation, database behavior, or business rules.

## 1. Enable timing markers

In the local, uncommitted `.env.local`, set:

```text
EXPO_PUBLIC_PERF_TRACE=1
```

Restart Metro after changing the value. The current markers cover:

- `clients.sqlite.read` - loading the agent's clients from SQLite
- `meetings.sqlite.read` - loading the agent's meetings
- `clients.visible` - the Clients screen has completed its loading state

Look for `[perf]` lines in the React Native DevTools Console or Metro logs.
Do not commit `.env.local` or copy real credentials into this document.

## 2. DevTools diagnosis

Use a development build with Hermes and connect React Native DevTools. Record
one trace for:

```text
Home -> My Clients -> Client Detail
```

Use the Performance panel and React Profiler. Enable “Highlight updates when
components render” to identify unnecessary re-renders. This trace explains
the cause; it is not the final speed benchmark because development mode is
slower.

## 3. Release-like user timing

Build/install the existing EAS preview APK:

```powershell
npm.cmd run build:preview:android
```

Install it on the physical Android device, then repeat the same flow five
times. Record cold launch, warm navigation, first visible UI, and first usable
UI. Compare the median, not the fastest run.

## 4. Baseline sheet

| Run | Cold/warm | Clients | Visible UI | Usable UI | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | cold | | | | |
| 2 | warm | | | | |
| 3 | warm | | | | |
| 4 | warm | | | | |
| 5 | warm | | | | |

Interpretation:

- Long `clients.sqlite.read`: data/query path is the first target.
- Short read but late `clients.visible`: render/filter/row computation is the
  first target.
- Fast screen but delayed tap feedback: inspect the JS thread and the work
  started directly by the press handler.

## Safety gate

Every optimization must be checked with `npm.cmd run lint`, `npx.cmd tsc
--noEmit`, the existing Vitest suite, and physical Android regression of the
Clients list, Client Detail, search/filter, pull-to-refresh, and offline data.

