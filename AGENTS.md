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
- `executeAction` uses the authoritative `resolveAction` registry. Do not add a second dispatch switch or metadata-only handler registry. Parameter readers select visible fields; builders validate and whitelist wire parameters.
- Share string/ID/boolean validation and request types. Parse and validate keyboards once in the request builder, including sparse-array rejection.

## VK Teams API Notes That Matter Here

- VK Teams Bot API uses long polling for inbound events. Do not design this package around inbound webhooks unless the product API changes and the docs confirm it.
- For chat-like responsiveness, prefer a long-lived `trigger()` loop over a scheduler-driven n8n polling node.
- Many VK Teams bot methods are `GET` endpoints with query parameters.
- Bot authentication is sent as the `token` query parameter.
- `sendText`, `editText`, `sendFile`, and `sendVoice` support optional `inlineKeyboardMarkup`. Keep the clickable rows/buttons editor and a separate opt-in `Inline Keyboard (JSON)` mode for dynamic collections. Both modes share validation and serialize to the Bot API array-of-arrays format.
- Use a scalar `json` parameter for dynamic keyboard expressions: n8n can discard expressions assigned to whole `fixedCollection` objects or row arrays during parameter normalization. Accept Bot API arrays, UI row arrays, full UI collections, and their JSON strings; never evaluate expressions inside the serializer.
- `sendText`, `editText`, and `sendFile` support optional `parseMode` (`HTML` or `MarkdownV2`); for `sendFile`, it applies to the caption.
- File uploads use `POST`, but ordinary method parameters still belong in query params; the multipart body is for the uploaded file payload.
- File download is a two-step flow:
  1. `GET /files/getInfo`
  2. download the returned external URL
- `chats/createChat` and `chats/members/add` are marked `myteam_only`/`privateMethod` by the official API. They are exposed with an explicit UI availability notice; server support and bot permissions remain unverified for any given installation. `chats/members/delete` and the supported moderation methods are ordinary SDK methods; their availability still depends on server permissions/configuration.
- Chat operations use explicit targets and an endpoint allowlist. Never infer everyone=true from a missing user ID. Member removal accepts a nonempty JSON array of distinct string IDs and serializes one query parameter containing [{"sn":"..."}]. Never coerce ID numbers or spread user input into query parameters.
- `chat.sendActions` serializes an array as repeated `actions` query keys; no actions must still produce a single empty `actions=`. Cross-check transport serialization, not just SDK method signatures.
- Route all network uploads through n8n helpers; no direct fetch or fallback that bypasses n8n policy. Native FormData is serialized to a Buffer with its Content-Type before passing it to the helper. Do not add multipart dependencies. All Bot API redirects are disabled and the HTTP timeout is 300 seconds; uploads remain fully buffered. Authentication must always come from credentials, never from request parameters.
- `chat.getMembers` returns one page and preserves its opaque cursor. `chat.setAvatar` uses multipart field `image`, unlike message uploads using `file`.
- Trigger user filters use addedBy/removedBy for membership events and from for the other events. Affected members are not actors. Missing user fields do not bypass an active filter; unpinnedMessage normally has no user field.

- Message Send Mode explicitly selects none/reply/forward. Validate nonempty unique string ID arrays and serialize repeated replyMsgId/forwardMsgId keys; never infer a mode or read hidden expressions.
- File Source defaults to binary. File ID uses GET on sendFile/sendVoice without reading storage or downloading anything, and does not require a new fileId in the response.
- Formatting defaults to the existing parseMode path. Explicit format JSON is mutually exclusive with parseMode; validate kinds/ranges and use the official pre field code. Never silently recalculate caller-supplied Unicode offsets.
- Threads use explicit add/autosubscribe/getSubscribers operations. No implicit autosubscription or pagination. Pagination mode selects pageSize or cursor, not hidden stale fields. Use the returned threadId as outgoing chatId.
- Include Threads is opt-in for matching incoming parent_topic.chatId, also in nested callback messages; it must not loosen user filtering or subscribe automatically.

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
- `newChatMembers`
- `leftChatMembers`
- `pinnedMessage`
- `unpinnedMessage`

Action operations:

- `bot.getSelf`
- `message.sendText`
- `message.sendFile`
- `message.sendVoice`
- `message.editText`
- `message.deleteMessages`
- `callback.answerCallbackQuery`
- `chat.getInfo`
- `chat.createChat`
- `chat.addMembers`
- `chat.getMembers`
- `chat.getAdmins`
- `chat.getBlockedUsers`
- `chat.getPendingUsers`
- `chat.deleteMembers`
- `chat.setTitle`
- `chat.setAbout`
- `chat.setRules`
- `chat.sendActions`
- `chat.blockUser`
- `chat.unblockUser`
- `chat.resolvePending`
- `chat.pinMessage`
- `chat.unpinMessage`
- `chat.setAvatar`
- `thread.add`
- `thread.autosubscribe`
- `thread.getSubscribers`
- `file.getInfo`
- `file.download`

## Known Product Limits

- Trigger file download currently inspects top-level message parts only.
- Uploads are fully buffered; this package does not offer streaming or resumable uploads.
- Supported scope is not exhaustive server API coverage. The two exposed private methods may fail on a given server; other endpoints/events outside the documented list remain unexposed.
- File ID reuse works on the same server; do not claim cross-installation portability. Full upload buffering remains a known limit. SDK-only changedChatInfo, deeplink and request-id idempotency are not exposed without a verified contract.
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
- Reuse identical OpenAPI response objects through components.responses; schema lint must resolve these references before validating operation contracts.
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

Keyboard regression tests must also exercise n8n parameter normalization and expression evaluation before inspecting the outgoing query string. Already-resolved `getNodeParameter` mocks alone cannot detect lost collection expressions.

Each test file should begin with plain-language test cases when the scenario set is not obvious.

Avoid names that suggest scheduler-driven polling for the trigger implementation. This trigger uses a long-lived `trigger()` loop, so internal helper names should reflect long polling rather than `poll()`.

## Verification Expectations

Before claiming work is complete, run fresh:

- `npm test`
- `npm run lint`
- `npm run lint:types`
- `npm run build`

The PR/master CI workflow runs this verification set and `npm pack --dry-run` with read-only repository permissions. It must not publish packages or require live bot credentials.

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
- npm publication uses Trusted Publisher with GitHub Actions OIDC. Do not add `NPM_TOKEN` to the workflow.
- The npm trusted publisher must target GitHub Actions for `pfrankov/n8n-nodes-vk-teams`, workflow filename `publish-npm.yml`, with `npm publish` allowed.
- Release builds disable npm cache via `package-manager-cache: false`.
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
- `docs/workflows/vk-teams-node-verification.workflow.json` and `docs/workflows/README.md` are the reusable manual verification artifacts for real-bot checks. Update them when node surface, required credentials, expected outputs, or the live verification flow changes. The separate `vk-teams-chat-verification.workflow.json` extends the matrix with read-only chat requests, disabled disconnected mutation examples, and an independent event branch; never broaden the existing callback branch to non-callback events. The separate `vk-teams-dynamic-keyboard.workflow.json` covers variable-length keyboard expressions without changing the existing verification matrix.
- Node descriptions and metadata are part of the public documentation surface. When changing display names, options, defaults, resource names, operation names, credential fields, icons, or node registration, keep README examples, changelog wording, tests, and package metadata aligned.
- When supported trigger events or action operations change, update all of these in the same work item: `Supported v1 Scope` in this file, README supported lists, node descriptions, tests, and changelog if the change is release-relevant.
- When known limitations change, update `Known Product Limits` here and the README limitations section. If users need to notice the change during upgrade, also update `CHANGELOG.md`.
- When packaging, npm publishing, release workflow, or local load behavior changes, update README installation/development guidance and this file's verification or release expectations as needed.
- Before finalizing documentation-affecting work, search for stale public names and removed operations with `rg`, then check that examples still use current node names, event names, operation ids, credential names, and option names.

## Changelog Maintenance

- Keep `CHANGELOG.md` current for every release-relevant change.
- Write changelog entries in Russian for package users, not for maintainers reading the source.
- Keep pending user-visible changes under `## Не выпущено` until a release is requested; do not assign an unreleased change to an existing tag. Released sections are tag-based. Each release heading is only the tag name, for example `## v0.1.0`, with no separate date.
- Summarize the diff from the previous tag to the current tag. Before finalizing an entry, compare the previous tag with current `HEAD`; do not rely on memory.
- Start each bullet with the user-visible effect: what changed in n8n, VK Teams behavior, credentials, supported operations, packaging, installation, or verification. Add implementation details only when they help the user identify the affected node, option, operation, or workflow.
- Use Russian section headings: `Добавлено`, `Улучшено`, `Исправлено`, `Сопровождение`, `Для разработки`.
- Include only changes that help someone decide whether to update: new capabilities, supported-operation changes, fixed user-visible problems, setup or credential changes, packaging and publish changes, important limitations, or minimum-runtime changes.
- Skip internal refactors, test-only edits, formatting, `.gitignore`, and purely mechanical maintenance unless they materially affect package users.
- Do not add meta/disclaimer lines such as "this section covers changes between versions". Start directly with the changes.
- For substantive releases, include `Кому важно` with concrete affected scenarios or user types.
- For substantive releases, include `Что проверить после обновления` with concrete n8n/VK Teams checks: node discovery, credentials, trigger activation, message send/edit/delete, file upload/download, callback query handling, package loading, or publish/install verification.
- User impact must be explicit in the entry body. Do not invent product motivation unless it is supported by code, docs, issue text, or commit messages.
- Public names from the node surface are allowed: node names, event names, operation ids, credential names, and npm commands. Avoid internal helper names, file paths, and implementation classes unless the section is explicitly `Для разработки`.
- If an item maps to a single commit, append only a short commit hash with no URL.
