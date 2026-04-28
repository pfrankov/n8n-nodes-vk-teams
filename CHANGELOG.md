# CHANGELOG

## v0.1.2

### Добавлено

- `VK Teams` -> `Message` -> `Send Text` и `Edit Text` теперь поддерживают `Parse Mode` (`HTML` или `MarkdownV2`) для форматирования текста.
- `VK Teams` -> `Message` -> `Send Text`, `Edit Text`, `Send File` и `Send Voice` теперь позволяют собрать inline-клавиатуру через UI из строк и кнопок, без ручного JSON.
- В `Send File` появился `Caption`; `Parse Mode` применяется к подписи файла.
- Проверочный workflow `VK Teams node verification matrix` теперь возвращает ожидаемые `callbackData`, отправляет реальные сообщения с inline-кнопками и показывает отдельную trigger-ветку для ручной проверки `callbackQuery` и `callback.answerCallbackQuery` на живом боте.

### Улучшено

- В конструкторе inline-кнопок поля `Callback Data` и `URL` теперь показываются условно в зависимости от выбранного `Button Type`, чтобы упростить настройку callback- и URL-кнопок.

### Для разработки

- Добавлены unit-тесты на сборку inline-клавиатуры, query-параметров и выполнение action-операций с `parseMode` и `inlineKeyboardMarkup`.

Кому важно:

- Пользователям, которые отправляют из n8n интерактивные сообщения VK Teams с callback- или URL-кнопками и не хотят собирать `inlineKeyboardMarkup` вручную.
- Тем, кому нужно форматировать исходящие сообщения и подписи файлов через `HTML` или `MarkdownV2` прямо в параметрах узла.
- Тем, кто проверяет пакет на реальном боте и хочет видеть фактические `callbackQuery` и ответ на них в отдельной trigger-ветке verification workflow.

Что проверить после обновления:

1. Убедиться, что в `VK Teams` -> `Message` -> `Send Text` появились `Parse Mode` и `Keyboard` -> `Inline Keyboard`.
2. Отправить тестовое сообщение с `HTML` или `MarkdownV2` и проверить форматирование в VK Teams.
3. Отправить сообщение с callback-кнопкой, нажать её и проверить событие `callbackQuery` через `VK Teams Trigger`.
4. Повторить `Edit Text`, `Send File` и `Send Voice` с inline-клавиатурой и убедиться, что параметры доходят корректно.
5. Импортировать или обновить `docs/workflows/vk-teams-node-verification.workflow.json`, активировать workflow на время проверки callback и убедиться, что trigger-ветка получает реальные нажатия.

## v0.1.1

### Добавлено

- Добавлен переносимый draft-workflow `docs/workflows/vk-teams-node-verification.workflow.json` и короткий runbook по его импорту, повторному запуску и пересинхронизации, чтобы регрессионно прогонять `VK Teams` и `VK Teams Trigger` на реальном боте без ручной сборки тестовой схемы в n8n.

### Исправлено

- `VK Teams` теперь корректно отправляет `message.sendFile` и `message.sendVoice`, когда n8n хранит incoming binary data во внешнем binary storage, а не inline в item; это устраняет падения отправки файла и голосового сообщения в таких инсталляциях.

Кому важно:

- Пользователям self-hosted n8n, у которых binary data вынесены во внешнее хранилище и операции `message.sendFile` или `message.sendVoice` раньше срывались на чтении входного файла.
- Тем, кто поддерживает пакет и хочет быстро прогонять ручную VK Teams-регрессию через готовый workflow, а не собирать проверочную схему заново в каждом стенде.

Что проверить после обновления:

1. Повторить `VK Teams` -> `Message` -> `Send File` и `Send Voice` на instance, где n8n не хранит binary data inline.
2. При необходимости импортировать `docs/workflows/vk-teams-node-verification.workflow.json`, назначить `VK Teams API` credentials и прогнать form-ветку на выделенном тестовом `chatId`.
3. Если проверяете trigger-ветку, убедиться, что workflow остаётся draft вне самой проверки и не запускает лишний параллельный long-poll consumer для того же бота.

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
- Добавлен GitHub Actions workflow для публикации npm-пакета по релизному тегу `v*` с проверками, `npm pack --dry-run` и `npm publish --provenance`.

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
