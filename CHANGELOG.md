# CHANGELOG

## v0.1.0

### Добавлено

- Добавлен пакет `n8n-nodes-vk-teams` для self-hosted n8n с двумя узлами: `VK Teams Trigger` для входящих событий бота и `VK Teams` для исходящих Bot API операций.
- `VK Teams Trigger` запускает workflow через long polling и поддерживает события `message`, `editedMessage`, `deletedMessage` и `callbackQuery`.
- В trigger-узле доступны фильтры по типу события, `chatId` и `userId`, чтобы workflow реагировал только на нужные чаты и пользователей.
- Для входящих сообщений с файлами можно включить `Download Files`, чтобы вложения попадали в binary output n8n.
- Узел `VK Teams` поддерживает операции `bot.getSelf`, `message.sendText`, `message.sendFile`, `message.sendVoice`, `message.editText`, `message.deleteMessages`, `callback.answerCallbackQuery`, `chat.getInfo`, `file.getInfo` и `file.download`.
- Добавлены credentials `VK Teams API` с `Bot Token` и `Base URL`; базовый URL нормализуется и не дублирует `/bot/v1`, если путь уже указан.

### Сопровождение

- Добавлена локальная OpenAPI-подобная схема поддерживаемого VK Teams Bot API scope и проверка `npm run lint:types`.
- Добавлен GitHub Actions workflow для публикации npm-пакета по релизному тегу `v*` с проверками, `npm pack --dry-run`, `npm publish --provenance` и созданием GitHub Release.

### Ограничения

- Входящие события работают через long polling; webhook-режим не входит в публичную поверхность версии `v0.1.0`.
- `VK Teams Trigger` скачивает вложения только из верхнего уровня `payload.parts`.
- `message.sendFile` и `message.sendVoice` отправляют файлы из incoming binary data n8n и пока не переиспользуют существующий VK Teams `fileId`.
- Административные on-premise операции, включая создание чатов и управление участниками, не входят в текущий публичный scope.

Кому важно:

- Пользователям self-hosted n8n, которым нужен бот VK Teams / VK WorkSpace без отдельного middleware между n8n и Bot API.
- Командам, которым достаточно long polling, отправки сообщений, callback query и базовой работы с файлами внутри workflow n8n.

Что проверить после обновления:

1. Установить пакет в self-hosted n8n и перезапустить n8n: `npm install n8n-nodes-vk-teams`.
2. Убедиться, что в списке узлов появились `VK Teams Trigger` и `VK Teams`, а в credentials доступен тип `VK Teams API`.
3. Создать credentials с bot token и `Base URL`, затем выполнить `VK Teams` -> `Bot` -> `Get Self`.
4. Активировать workflow с `VK Teams Trigger` на событие `message` и отправить сообщение боту в VK Teams.
5. Отправить ответ через `VK Teams` -> `Message` -> `Send Text` и проверить доставку в нужный `chatId`.
6. Если workflow работает с файлами, проверить входящее вложение с `Download Files` и исходящую отправку файла из binary input.
