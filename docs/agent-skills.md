# Skills for DTEK Monitor

Selection reviewed on October 8, 2026 against the repository's stack and code:
Node.js, Playwright Chromium, Telegram Bot API, and systemd.
The recommendations below reflect an assessment of their fit for this project.

The [skills.sh leaderboard](https://skills.sh/) was checked first, followed by
skill pages, their source `SKILL.md` files, and GitHub repositories. The CLI
search `npx skills find playwright` failed with the network error `EAI_AGAIN`;
discovery and source verification were completed through the browser.

This is an agent-facing document. Keep it and all agent files, skills, and rules
exclusively in English, as required by [AGENTS.md](../AGENTS.md).

## Recommendations

Approximate installation counts are from skills.sh; repository stars are from
GitHub as of the review date. Microsoft is an official source; the other
repositories are community collections.

| Skill | Source | Installs | Repository stars | Use in this project |
| --- | --- | --- | --- | --- |
| [playwright-cli](https://skills.sh/microsoft/playwright-cli/playwright-cli) | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) | ~177.6K | ~13.9K | Inspect the DTEK page's DOM, selectors, and selectors when data retrieval fails |
| [javascript-testing-patterns](https://skills.sh/wshobson/agents/javascript-testing-patterns) | [wshobson/agents](https://github.com/wshobson/agents) | ~19.8K | ~40.3K | Add tests when needed: mock HTTP responses and verify notifications, errors, and state transitions |

The first skill matches an existing project tool. The second supports the
built-in `node:test` suite used for isolated logic checks.

## Installed project skills

Both recommended skills are installed as project-local files under
`.agents/skills/`, including the upstream reference documents. See
[.agents/README.md](../.agents/README.md) for direct links to their instructions
and sources. They were installed with the `skill-installer` helper after
downloading and reviewing the files in a temporary directory.

Skill installation does not install the Playwright CLI executable or change
the monitor's npm dependencies.

## Installation commands

Run these commands from the project root. They install the selected skill for
Codex at project scope; add `-g` for user-level installation. Options are
documented in the [Skills CLI](https://github.com/vercel-labs/skills#readme).

```bash
npx skills add microsoft/playwright-cli --skill playwright-cli --agent codex
npx skills add wshobson/agents --skill javascript-testing-patterns --agent codex
```

Apply only the skill relevant to the current task and follow
[AGENTS.md](../AGENTS.md), including its English-only policy for agent artifacts.

## Scope and adaptation

- `playwright-cli` requires a separate CLI tool for browser diagnostics; the
  skill itself does not install it. See the available setup options in the
  [Microsoft documentation](https://github.com/microsoft/playwright-cli#installation).
  The monitor's `playwright` dependency remains the basis of the runtime script.
- The testing skill focuses on Jest/Vitest. Its isolation and mocking patterns
  can be applied using built-in `node:test` without adding a framework.

Reviewed skill source instructions:
[Playwright](https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/SKILL.md),
[JavaScript testing](https://github.com/wshobson/agents/blob/main/plugins/javascript-typescript/skills/javascript-testing-patterns/SKILL.md).
