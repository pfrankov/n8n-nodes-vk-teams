# AGENTS.md

This is a living file. Keep it synchronized with the actual package behavior, API scope, and engineering rules whenever the project changes.

## Product Intent

This repository contains an n8n community node package for VK Teams bots.

Public node surface:

- `VkTeams Trigger`
- `VkTeams`

The package is intentionally split into trigger and action nodes, similar to Telegram in n8n, but with smaller internals and stronger unit-level testability.

## Current Technical Shape

- `VkTeams Trigger` is a long-lived trigger node built with `trigger()`, not a scheduler-driven `poll()` node.
- `VkTeams` is a programmatic action node.
- Internals are built around small pure helpers:
  - request builders
  - request execution helpers
  - trigger filtering and long-poll helpers
- Node wrappers should stay thin. Endpoint-specific logic belongs in handlers/builders, not directly in `execute()` or `trigger()`.

## VK Teams API Notes That Matter Here

- VK Teams Bot API uses long polling for inbound events. Do not design this package around inbound webhooks unless the product API changes and the docs confirm it.
- For chat-like responsiveness, prefer a long-lived `trigger()` loop over a scheduler-driven n8n polling node.
- Many VK Teams bot methods are `GET` endpoints with query parameters.
- Bot authentication is sent as the `token` query parameter.
- File uploads use `POST`, but ordinary method parameters still belong in query params; the multipart body is for the uploaded file payload.
- File download is a two-step flow:
  1. `GET /files/getInfo`
  2. download the returned external URL
- `createChat`, member management, and some administrative endpoints are on-prem/private-only. Keep them out of the public surface until there is an explicit scope expansion and tests for them.

Useful references:

- Local OpenAPI-style supported scope: `docs/vk-teams-bot-api.openapi.yaml`
- VK Teams Bot API: https://teams.vk.com/botapi/
- VK Workspace bot docs: https://workspace.vk.ru/docs/saas/vks-messenger/messenger/bot/
- Official Python SDK: https://github.com/mail-ru-im/bot-python
- Official Java SDK: https://github.com/mail-ru-im/bot-java
- Modern Python reference implementation: https://github.com/Quakeer444/vk_teams_async_bot

## Supported `v1` Scope

Trigger events:

- `message`
- `editedMessage`
- `deletedMessage`
- `callbackQuery`

Action operations:

- `bot.getSelf`
- `message.sendText`
- `message.sendFile`
- `message.sendVoice`
- `message.editText`
- `message.deleteMessages`
- `callback.answerCallbackQuery`
- `chat.getInfo`
- `file.getInfo`
- `file.download`

## Known Product Limits

- Trigger file download currently inspects top-level message parts only.
- `message.sendFile` and `message.sendVoice` currently use incoming binary data, not pre-existing VK Teams `fileId` reuse.
- No send-and-wait behavior yet.
- No declarative node implementation here by design; binary handling and trigger behavior make programmatic style simpler and easier to test.
- `n8n.strict` is set to `false` so the repository can keep a local TypeScript test harness alongside production source. Keep production lint/build quality high anyway.

## Engineering Rules For This Repository

- Start behavior changes with tests.
- Prefer pure helpers over runtime-heavy mocks.
- Keep cyclomatic complexity under 10 per function.
- Prefer direct names and direct control flow.
- Do not extract one-off helpers unless that extraction is needed to keep complexity or file size under control.
- Keep files near or below 500 lines.
- Comments should explain non-obvious behavior only.
- If a design starts resembling a single large Telegram-style action file, stop and split the responsibility earlier.

## Test Strategy

Primary coverage should live in small unit tests for:

- URL and transport option assembly
- action request builders
- action execution orchestration
- trigger filters
- trigger long-poll state handling
- trigger file-download enrichment
- trigger manual-mode and active-mode loop behavior

Thin node wrappers are allowed to rely on the pure modules above; do not push most logic into n8n runtime methods.

Each test file should begin with plain-language test cases when the scenario set is not obvious.

Avoid names that suggest scheduler-driven polling for the trigger implementation. This trigger uses a long-lived `trigger()` loop, so internal helper names should reflect long polling rather than `poll()`.

## Verification Expectations

Before claiming work is complete, run fresh:

- `npm test`
- `npm run lint`
- `npm run lint:types`
- `npm run build`

When touching node registration, credentials, or packaging, also perform a local load check with `npm run dev` and confirm both nodes appear in n8n.

If live VK Teams credentials are available, verify API alignment against a real bot before closing major API changes. If not available, state that precisely in the final report.

## Release Process

- Create release commits and tags with `npm version`, not with `npm run release` or `n8n-node release`.
- Release tags must use npm's default `v` prefix and must match `package.json` exactly, for example package version `0.1.0` is released as tag `v0.1.0`.
- Before running `npm version`, update `CHANGELOG.md`, update any relevant docs, run the full verification set, and confirm the target tag does not already exist locally or on `origin`.
- For a normal bump, use `npm version patch`, `npm version minor`, `npm version major`, or an explicit semver version with `-m "v%s"`.
- For the first release when `package.json` already contains the desired version, use `npm version <current-version> --allow-same-version -m "v%s"`.
- `npm version` normally requires a clean working tree. If release notes or documentation changes must be included in the version commit, stage only those reviewed files, re-check `git status`, then use `npm version ... --force -m "v%s"`. Do not use `--force` with unreviewed or unrelated changes.
- Push the branch and the exact release tag together: `git push origin master vX.Y.Z`.
- Pushing the release tag triggers `.github/workflows/publish-npm.yml`; check the GitHub Actions run before considering the release complete.
- The publish workflow intentionally uses `npm publish --ignore-scripts` because this package keeps `prepublishOnly: n8n-node prerelease` as a local manual-publish guard. CI must run tests, lint, type/schema lint, build, and `npm pack --dry-run` before publishing, then skip npm lifecycle scripts only for the final publish command.

## Documentation Expectations

- Keep `README.md` in Russian and user-oriented.
- Keep `CHANGELOG.md` in Russian and user-oriented.
- Keep this file in English and engineering-oriented.
- Update the relevant docs when behavior, supported operations, release-relevant changes, or important limitations change.
- Do not turn these files into generic starter boilerplate again.

## Documentation Synchronization

- Treat public behavior changes as incomplete until the public docs, release notes, and local API contract agree with the code.
- `README.md` is the user-facing source for installation, credentials, quick start flows, supported events, supported operations, file handling, schema location, and known limitations.
- `CHANGELOG.md` is the release-facing source for user-visible changes since the previous tag.
- `AGENTS.md` is the engineering-facing source for durable product scope, architecture rules, verification expectations, and documentation policy. Do not store one-off release notes or temporary rollout details here.
- `docs/vk-teams-bot-api.openapi.yaml` is the supported Bot API contract for this package. Update it when adding, removing, or changing supported endpoints, parameters, payloads, multipart behavior, response shapes, or event shapes.
- `docs/workflows/vk-teams-node-verification.workflow.json` and `docs/workflows/README.md` are the reusable manual verification artifacts for real-bot checks. Update them when node surface, required credentials, expected outputs, or the live verification flow changes.
- Node descriptions and metadata are part of the public documentation surface. When changing display names, options, defaults, resource names, operation names, credential fields, icons, or node registration, keep README examples, changelog wording, tests, and package metadata aligned.
- When supported trigger events or action operations change, update all of these in the same work item: `Supported v1 Scope` in this file, README supported lists, node descriptions, tests, and changelog if the change is release-relevant.
- When known limitations change, update `Known Product Limits` here and the README limitations section. If users need to notice the change during upgrade, also update `CHANGELOG.md`.
- When packaging, npm publishing, release workflow, or local load behavior changes, update README installation/development guidance and this file's verification or release expectations as needed.
- Before finalizing documentation-affecting work, search for stale public names and removed operations with `rg`, then check that examples still use current node names, event names, operation ids, credential names, and option names.

## Changelog Maintenance

- Keep `CHANGELOG.md` current for every release-relevant change.
- Write changelog entries in Russian for package users, not for maintainers reading the source.
- Use tag-based sections. Each release heading is only the tag name, for example `## v0.1.0`, with no separate date.
- Summarize the diff from the previous tag to the current tag. Before finalizing an entry, compare the previous tag with current `HEAD`; do not rely on memory.
- Start each bullet with the user-visible effect: what changed in n8n, VK Teams behavior, credentials, supported operations, packaging, installation, or verification. Add implementation details only when they help the user identify the affected node, option, operation, or workflow.
- Use Russian section headings: `Добавлено`, `Улучшено`, `Исправлено`, `Сопровождение`, `Для разработки`.
- Include only changes that help someone decide whether to update: new capabilities, supported-operation changes, fixed user-visible problems, setup or credential changes, packaging and publish changes, important limitations, or minimum-runtime changes.
- Skip internal refactors, test-only edits, formatting, `.gitignore`, and purely mechanical maintenance unless they materially affect package users.
- Do not add meta/disclaimer lines such as "this section covers changes between versions". Start directly with the changes.
- For substantive releases, include `Кому важно` with concrete affected scenarios or user types.
- For substantive releases, include `Что проверить после обновления` with concrete n8n/VK Teams checks: node discovery, credentials, trigger activation, message send/edit/delete, file upload/download, callback query handling, package loading, or publish/install verification.
- User impact must be explicit in the entry body. Do not invent product motivation unless it is supported by code, docs, issue text, or commit messages.
- Public names from the node surface are allowed: node names, event names, operation ids, credential names, option names, and npm commands. Avoid internal helper names, file paths, and implementation classes unless the section is explicitly `Для разработки`.
- If an item maps to a single commit, append only a short commit hash with no URL.
