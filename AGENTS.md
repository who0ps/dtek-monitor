# Agent Instructions

## Language policy

All agent-facing files, skills, and rules must be written exclusively in English.
This includes root and nested `AGENTS.md` files, `SKILL.md` files and their
supporting agent instructions, rule files, agent configuration documentation,
and `docs/agent-skills.md`. Apply this policy when creating or updating these
files, and check their language before completing the task.

Communicate with the user in Ukrainian unless they request another language.
Keep user-facing documentation and notification messages in Ukrainian.

## Project

DTEK Monitor checks the DTEK Kyiv shutdowns page for a general emergency
notice (emergency outages, outage schedules not in effect) and sends, updates,
or deletes a Telegram notification. It has no address-specific logic.

Stack: Node.js 22, JavaScript ES modules, Playwright Chromium, built-in `fetch`,
and systemd on the server. Check `.nvmrc` and `package.json` for the
Node.js version. The project has no compilation step.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/monitor.js` | Browser automation, emergency notice detection, Telegram API, and a single monitoring run |
| `src/helpers.js` | JSON state persistence and date/text formatting |
| `src/constants.js` | Environment variables, the DTEK URL, and state file paths |
| `test/*.test.js` | Isolated `node:test` coverage for monitor behavior and state helpers |
| `artifacts/` | Runtime state, git-ignored: `emergency-outages.json` (`active`) and `emergency-outages-message.json` (`message_id`, `date`) |
| `deploy/` | Example systemd service and timer for running on a server |
| `.env.example` | Configuration template without secrets |
| `README.md` | User setup and usage documentation |

## Workflow and code style

- Read the relevant files and check `git status --short` before making changes.
  Preserve existing user changes and keep the diff within the task's scope.
- Use npm and `package-lock.json`. Use `npm ci` for reproducible installation;
  install Chromium with `npx playwright install chromium`.
- Follow `.prettierrc.json`: two-space indentation, no semicolons, double quotes,
  and ES5 trailing commas. Avoid unrelated formatting changes.
- Preserve ES modules, `.js` extensions in local imports, and the `node:` prefix
  for built-in modules. Prefer built-in Node.js APIs.
- Add dependencies only for a concrete need; update the lockfile together with
  `package.json`. Adapt skill templates to this small monitoring script.
- Update `README.md` and, when relevant, `.env.example` when changing
  configuration, startup, or notification behavior. Do not overwrite an
  existing `.env` file.

## Behavior to account for

- Only the general emergency notice is handled. Keep browser cleanup in
  `finally`. A failed or uncertain notice check must throw, never be treated as
  "no notice".
- When the notice disappears, delete its Telegram notification without sending
  a cancellation message; reset `active` only after successful deletion.
- Continue editing the same existing message across calendar-date changes.
  Format user-facing dates in the `Europe/Kyiv` time zone.
- Telegram uses `parse_mode: "HTML"`. When changing message generation,
  account for escaping external data.
- Preserve JSON state compatibility and first-run behavior without state
  files. Do not modify live `artifacts/` as a side effect of code validation.
- The script performs a single check; periodic runs are scheduled externally
  (systemd timer, see `deploy/`).

## Validation

Check syntax without running the monitor:

```bash
node --check src/constants.js
node --check src/helpers.js
node --check src/monitor.js
git diff --check
```

`package.json` provides `start` and `test`; there are no `lint` or
`build` commands. Report only checks that actually ran; syntax checks do not
validate logic. For logic changes, add focused checks using `node:test`, with
mocked browser, `fetch`, and time, plus a temporary state directory.
Documentation-only changes do not need new tests.

Relevant scenarios: appearance and disappearance of the general notice; day
rollover in Kyiv; HTTP/Telegram errors; and missing or corrupted state.

## External services and secrets

- `npm start` and `node src/monitor.js` contact DTEK, may send, edit, or delete Telegram messages, and update
  state. Importing `src/monitor.js` also starts a check. Use isolated mocks for
  routine validation; run live checks when they are within the user's request.
- Do not print or commit `.env`, tokens, private addresses, or full Telegram
  URLs containing tokens. Use fictional values in examples.
- Do not run multiple monitors against the same state concurrently.

## Skills

Project-local skills are installed in `.agents/skills/`. Read the relevant
`SKILL.md` before applying a skill:

- [playwright-cli](.agents/skills/playwright-cli/SKILL.md): inspect the DTEK page,
  DOM and selectors.
- [javascript-testing-patterns](.agents/skills/javascript-testing-patterns/SKILL.md):
  isolate logic checks and external API calls.

Sources and installation details: [.agents/README.md](.agents/README.md) and
[docs/agent-skills.md](docs/agent-skills.md).

Skills supplement these instructions and are not monitor dependencies.
Their absence does not block work. Apply examples with other Node.js versions,
test frameworks, or services only when the current task requires them.
