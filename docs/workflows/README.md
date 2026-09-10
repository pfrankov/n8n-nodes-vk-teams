# Проверочный workflow

В этом каталоге хранится переносимый draft-workflow `vk-teams-node-verification.workflow.json` для ручной регрессионной проверки узлов `VK Teams` и `VK Teams Trigger` на реальном боте VK Teams.

Workflow теперь состоит из двух независимых веток:

1. `Run VK Teams Verification Form` отправляет тестовые сообщения и возвращает `runId`, ожидаемые `callbackData` и `messageIds`.
2. Пользователь реально нажимает callback-кнопки в VK Teams.
3. Trigger-ветка `VK Teams Trigger All Events` ловит реальные `callbackQuery`, пытается выполнить `Answer Callback Query` на реальном `queryId`, параллельно отправляет обычное текстовое подтверждение `Send Callback Confirmation` в чат и пишет компактный итог в `Summarize Trigger Event`.

## Что покрывает workflow

- `VK Teams`: `bot.getSelf`, `chat.getInfo`, `message.sendText`, `message.editText`, `message.deleteMessages`, `message.sendFile`, `message.sendVoice`, `file.getInfo`, `file.download` и `callback.answerCallbackQuery`, если передан `callbackQueryId`.
- `message.sendText`, `message.editText`, `message.sendFile` и `message.sendVoice` дополнительно проверяют кликабельную inline-клавиатуру с callback- и URL-кнопками.
- Trigger-ветка показывает реальные `callbackQuery` payload'ы, результат `callback.answerCallbackQuery` и независимое подтверждение через обычный `message.sendText` в чат.
- `VK Teams Trigger`: события `message`, `editedMessage`, `deletedMessage` и `callbackQuery` с включённым `Download Files`.
- Финальный отчёт `Build Verification Report` собирает статусы по action-ветке, а `Summarize Trigger Event` сжимает входящее событие trigger-ветки до удобного summary.

Экспорт в репозитории хранится с `"active": false`, чтобы workflow не запускал второй long-poll consumer случайно.

## Импорт в n8n

1. Импортируйте `docs/workflows/vk-teams-node-verification.workflow.json` в нужный instance n8n.
2. Назначьте credentials типа `VK Teams API` всем узлам `VK Teams` и `VK Teams Trigger` внутри workflow.
3. Для form-ветки подготовьте отдельный тестовый `chatId`, куда можно безопасно отправлять текст, файл и voice-message.
4. Перед callback-проверкой временно активируйте workflow, чтобы заработала trigger-ветка `callbackQuery`.
5. Если на этом же боте уже есть другой активный long-poll workflow, остановите его на время проверки, иначе callback-события может забрать другой consumer.

## Повторный запуск

1. Запустите `Run VK Teams Verification Form`.
2. Передайте `chatId`; `fileId` нужен только как fallback, если `message.sendFile` не вернёт его в ответе.
3. Сохраните `runId` и `expectedCallbacks` из output узла `Build Action Report`.
4. Активируйте workflow и реально нажмите callback-кнопки в сообщениях `Send Text`, `Edit Text`, `Send File` и `Send Voice`.
5. Откройте trigger execution этого workflow и проверьте output узла `Summarize Trigger Event`.
6. Для каждой нажатой кнопки проверьте:
`callbackData` совпадает с ожидаемым значением,
`runId` совпадает с action-веткой,
`answerStatus` показывает, прошёл или упал `Answer Callback Query`,
в чате появилось обычное сообщение `Callback received: ...` от узла `Send Callback Confirmation`.

## Динамическое меню тегов

Отдельный пример [`vk-teams-dynamic-keyboard.workflow.json`](vk-teams-dynamic-keyboard.workflow.json) проверяет JSON-режим, не меняя основную статическую матрицу.

1. Импортируйте пример, выберите credentials `VK Teams API` у `Send Dynamic Menus` и замените `YOUR_TEST_CHAT_ID` в `Build Tag Menus` на выделенный тестовый чат.
2. Выполните `Run Dynamic Keyboard Check`. Workflow отправит два сообщения: первое с одной кнопкой `@dev`, второе с двумя строками `@qa` и `@ops`.
3. Проверьте кнопки именно в клиенте VK Teams. Ответ `ok` не доказывает, что клавиатура отображается.
4. Через единственный активный `VK Teams Trigger` для этого бота проверьте нажатия: ожидаются `ping:dev`, `ping:qa`, `ping:ops`. Сам пример не запускает long polling.
5. Для проверки остальных форматов замените `Inline Keyboard (JSON)` на выражение `{{ { rows: $json.rows } }}`, `{{ $json.rows.map(r => r.row.buttons) }}` или `{{ JSON.stringify($json.rows) }}`. Результат должен остаться тем же.
6. Пустой массив `[]` должен отправить только текст. Кнопка без `text` или без действия должна завершиться ошибкой до API-запроса.

Для регрессии `Edit Text`, `Send File` и `Send Voice` используйте основную матрицу: переключите соответствующую ноду на `Inline Keyboard (JSON)` и задайте `[[{"text":"JSON check","callbackData":"json:check"}]]`. Сохраните остальные параметры и входные binary data, проверьте кнопку в клиенте и событие `json:check`.

## Пересинхронизация артефакта

1. Внесите изменения в workflow в редакторе n8n.
2. Экспортируйте обновлённый JSON обратно в `docs/workflows/vk-teams-node-verification.workflow.json`.
3. Перед коммитом проверьте diff: в артефакт не должны попасть секреты credentials, pinned data или instance-specific мусор.
4. Сохраните `active: false`, если задача не требует хранить в репозитории активный long-poll workflow.
5. Если изменился публичный node surface или сценарий проверки, синхронно обновите `README.md`, `CHANGELOG.md` и этот runbook.
