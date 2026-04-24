# Проверочный workflow

В этом каталоге хранится переносимый draft-workflow `vk-teams-node-verification.workflow.json` для ручной регрессионной проверки узлов `VK Teams` и `VK Teams Trigger` на реальном боте VK Teams.

## Что покрывает workflow

- `VK Teams`: `bot.getSelf`, `chat.getInfo`, `message.sendText`, `message.editText`, `message.deleteMessages`, `message.sendFile`, `message.sendVoice`, `file.getInfo`, `file.download` и `callback.answerCallbackQuery`, если передан `callbackQueryId`.
- `VK Teams Trigger`: события `message`, `editedMessage`, `deletedMessage` и `callbackQuery` с включённым `Download Files`.
- Финальный отчёт `Build Verification Report` собирает статусы по action-ветке, а `Summarize Trigger Event` сжимает входящее событие trigger-ветки до удобного summary.

Экспорт в репозитории хранится с `"active": false`, чтобы workflow не запускал второй long-poll consumer случайно.

## Импорт в n8n

1. Импортируйте `docs/workflows/vk-teams-node-verification.workflow.json` в нужный instance n8n.
2. Назначьте credentials типа `VK Teams API` всем узлам `VK Teams` и `VK Teams Trigger` внутри workflow.
3. Для form-ветки подготовьте отдельный тестовый `chatId`, куда можно безопасно отправлять текст, файл и voice-message.
4. Оставляйте workflow в draft-состоянии, если вам не нужен production URL формы или отдельная живая проверка trigger-ветки.

## Повторный запуск

1. Запустите form-ветку привычным для вашей среды способом через `Run VK Teams Verification Form`.
2. Передайте `chatId`; `fileId` нужен только как fallback, если `message.sendFile` не вернёт его в ответе; `callbackQueryId` нужен только для проверки `callback.answerCallbackQuery`.
3. Дождитесь узла `Build Verification Report` и проверьте `summary` и `checks` в итоговом output.
4. Если нужна trigger-проверка, временно активируйте workflow, отправьте боту тестовые `message` / `editedMessage` / `deletedMessage` / `callbackQuery` события и проверьте output узла `Summarize Trigger Event`.

## Пересинхронизация артефакта

1. Внесите изменения в workflow в редакторе n8n.
2. Экспортируйте обновлённый JSON обратно в `docs/workflows/vk-teams-node-verification.workflow.json`.
3. Перед коммитом проверьте diff: в артефакт не должны попасть секреты credentials, pinned data или instance-specific мусор.
4. Сохраните `active: false`, если задача не требует хранить в репозитории активный long-poll workflow.
5. Если изменился публичный node surface или сценарий проверки, синхронно обновите `README.md`, `CHANGELOG.md` и этот runbook.
