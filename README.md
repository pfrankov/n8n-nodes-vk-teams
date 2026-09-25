# n8n-nodes-vk-teams

[![npm version](https://img.shields.io/npm/v/n8n-nodes-vk-teams.svg)](https://www.npmjs.com/package/n8n-nodes-vk-teams)

`n8n-nodes-vk-teams` — community node package для [n8n](https://n8n.io), который подключает ботов **VK Teams / VK WorkSpace** через Bot API.

Пакет добавляет два узла:

| Узел | Для чего нужен |
| --- | --- |
| `VK Teams Trigger` | Запускает workflow по входящим событиям бота |
| `VK Teams` | Отправляет сообщения и выполняет Bot API операции |

## Возможности

### VK Teams Trigger

Поддерживаемые события:

- `message`
- `editedMessage`
- `deletedMessage`
- `callbackQuery`
- `newChatMembers`
- `leftChatMembers`
- `pinnedMessage`
- `unpinnedMessage`

Что доступно:

- long polling входящих событий
- фильтр по типу события
- фильтр по `chatId`
- фильтр по `userId`
- загрузка файлов из входящих событий в binary output

### VK Teams

Поддерживаемые операции:

- `bot.getSelf`
- `message.sendText`
- `message.sendFile`
- `message.sendVoice`
- `message.editText`
- `message.deleteMessages`
- `callback.answerCallbackQuery`
- `chat.getInfo`
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
- `file.getInfo`
- `file.download`

### Управление существующими чатами

`Chat` → `Get Members` возвращает **одну страницу**: `members` и, при наличии следующей страницы, `cursor`. Передайте его без изменений в поле `Cursor` следующего вызова. Если курсора нет, он пустой или `null`, обход завершён. Нода не выгружает весь состав автоматически и не выполняет скрытых повторных запросов.

`Delete Members` принимает в `Members (JSON)` непустой массив ID, например `["user1@example.com", "user2@example.com"]`, или выражение `={{ $json.members }}`. ID должны быть строками без дублей. Это удаление из чата, а не блокировка; `Block User` и `Unblock User` — отдельные операции для одного пользователя. Для серии блокировок используйте отдельные входные items n8n, чтобы видеть результат каждого запроса.

В `Resolve Pending` по умолчанию требуется конкретный `User ID`. Обработка всех заявок включается только переключателем `Everyone`. `Approve` определяет, принять или отклонить выбранные заявки. У `Block User` удаление последних сообщений по умолчанию выключено.

`Set About` и `Set Rules` позволяют очистить поле пустой строкой. В `Send Actions` доступны `typing` и `looking`; пустой выбор снимает индикаторы. Несколько действий передаются повторяющимися query-параметрами, а не одной строкой через запятую. `Set Avatar` получает изображение из binary-поля и отправляет его как multipart `image`. ID сообщений для закрепления и снятия закрепления передавайте строкой, без преобразования в JavaScript `Number`.

Результат API возвращается одним JSON item на входной item, без удаления дополнительных полей сервера. Типы списков (`members`, `admins`, `users`), флагов `admin`/`creator`, курсора и остальных ответов описаны в [схеме API](docs/vk-teams-bot-api.openapi.yaml). Ошибки `ok=false`, ответы только с `error` и ответы, не являющиеся JSON-объектом, проходят обычную обработку ошибок ноды; `Continue On Fail` сохраняет связь с исходным item.

Фильтр Trigger по пользователю проверяет `payload.addedBy.userId` для `newChatMembers`, `payload.removedBy.userId` для `leftChatMembers`, а для остальных событий — `payload.from.userId`. Участники из `newMembers`/`leftMembers` не считаются инициатором действия. `pinnedMessage` фильтруется по полю `from`, которое не следует считать отдельным подтверждением личности модератора. Событие без соответствующего пользователя, в частности обычный `unpinnedMessage`, не проходит непустой фильтр `Restrict To User IDs`.

Доступность операций зависит от версии сервера и прав бота. Создание чатов и добавление участников (`chats/createChat`, `chats/members/add`) относятся к отдельному private/on-premise API и **не добавлены** в общий список операций. Разбор источников и границ покрытия: [исследование issue #1](docs/issue-1-api-review.md). Это расширение существующих чатов, а не обещание полного покрытия всех API.

## Установка

Для self-hosted n8n:

```bash
npm install n8n-nodes-vk-teams
```

После установки перезапустите n8n.

Для локальной установки из репозитория:

```bash
cd /path/to/n8n-nodes-vk-teams
npm install
npm run build
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install /absolute/path/to/n8n-nodes-vk-teams
```

После этого также перезапустите n8n.

## Credentials

Используется один тип credentials: `VK Teams API`.

Поля:

- `Bot Token` — токен бота из Metabot
- `Base URL` — базовый адрес VK Teams API

Примеры `Base URL`:

- `https://api.internal.myteam.mail.ru`
- `https://teams.company.example`
- `https://teams.company.example/bot/v1`

Если указан только хост, пакет добавит `/bot/v1`. Если URL уже заканчивается на `/bot/v1`, путь не будет продублирован.

## Быстрый старт

### Получить входящее сообщение

1. Добавьте `VK Teams Trigger`.
2. Выберите событие `message`.
3. Подключите credentials `VK Teams API`.
4. Активируйте workflow.
5. Напишите боту в VK Teams.

Для ограничения источников используйте поля:

- `Restrict To Chat IDs` — один или несколько `chatId` через запятую
- `Restrict To User IDs` — один или несколько `userId` через запятую

Чтобы получать вложения как binary data, включите `Download Files`.

### Отправить сообщение

1. Добавьте `VK Teams`.
2. Выберите `Resource` → `Message`.
3. Выберите `Operation` → `Send Text`.
4. Заполните `Chat ID` и `Text`.
5. Запустите workflow.

Для форматирования текста в `Send Text` и `Edit Text` выберите `Parse Mode`: `HTML` или `MarkdownV2`. Если форматирование не нужно, оставьте `None`.

Для inline-клавиатуры выберите `Keyboard` → `Inline Keyboard`, добавьте строки и кнопки через UI. Каждая кнопка содержит `Text`, `Button Type` (`Callback Data` или `URL`) и `Style`: `base`, `primary`, `attention`.

Когда выбран `Button Type = Callback Data`, показывается поле `Callback Data`. Когда выбран `Button Type = URL`, показывается поле `URL`.

Клавиатуры доступны в `Send Text`, `Edit Text`, `Send File` и `Send Voice`. Для `Send File` также можно указать `Caption`; `Parse Mode` применяется к тексту сообщения или подписи файла.

### Динамическая клавиатура

Для переменного числа строк или кнопок выберите `Keyboard` → `Inline Keyboard (JSON)`. В поле `Inline Keyboard (JSON)` переключитесь на Expression и передайте данные предыдущего узла, например `{{ $json.rows }}`. В экспортированном workflow это выражение записывается как `={{ $json.rows }}`.

Поддерживаются массив строк из редактора `[{"row":{"buttons":[...]}}]`, полный объект `{"rows":[...]}` и массив массивов кнопок Bot API. Можно передать объект/массив напрямую или его JSON-строку; `JSON.stringify` не обязателен.

Пример данных для Code-узла:

```javascript
return [{
  json: {
    chatId: 'YOUR_TEST_CHAT_ID',
    text: 'Кого пингануть?',
    rows: ['dev', 'qa'].map(tag => ({
      row: {
        buttons: [{
          buttonType: 'callbackData',
          text: `@${tag}`,
          callbackData: `ping:${tag}`,
          style: 'primary',
        }],
      },
    })),
  },
}];
```

В `VK Teams` укажите `Chat ID` → `{{ $json.chatId }}`, `Text` → `{{ $json.text }}` и `Inline Keyboard (JSON)` → `{{ $json.rows }}`. Для формата Bot API достаточно `[[{"text":"Открыть","url":"https://example.com"}]]`: тип кнопки определяется по `url` или `callbackData`. Без `buttonType` у кнопки должно быть только одно из этих действий; стиль по умолчанию — `base`.

Не подставляйте выражение вместо всей коллекции `Inline Keyboard` или `Rows` в обычном редакторе: n8n может удалить его при нормализации `fixedCollection` ещё до выполнения ноды. Для таких workflow нужно явно переключиться на JSON-режим. Настроенные через UI клавиатуры менять не требуется.

Пустая клавиатура не отправляется. Некорректный JSON или неполная кнопка приводят к ошибке до запроса к API, а не к успешной отправке без кнопок. Проверочный пример: [`vk-teams-dynamic-keyboard.workflow.json`](docs/workflows/vk-teams-dynamic-keyboard.workflow.json).

## Работа с файлами

Загрузка аватара, файла и голосового сообщения выполняется через HTTP-helper n8n с его сетевыми настройками и проверками, HTTP-таймаутом 300 секунд и без автоматических перенаправлений. В credentials нужен конечный адрес Bot API. Неуспешный HTTP-статус считается ошибкой; автоматического повтора загрузки нет. Если настроенные ограничения n8n запрещают адрес сервера, согласуйте разрешённый адрес с администратором, а не обходите ограничения. Загрузки полностью буферизуются в памяти; потоковая передача файлов не реализована.

`message.sendFile` и `message.sendVoice` берут файл из binary input предыдущего узла. Укажите `Input Binary Field`, в котором лежит файл.

`file.download` сначала получает метаданные через `file.getInfo`, затем скачивает файл и возвращает JSON с метаданными вместе с binary output.

## Схема API

OpenAPI-подобная схема поддерживаемого Bot API scope лежит в [`docs/vk-teams-bot-api.openapi.yaml`](docs/vk-teams-bot-api.openapi.yaml). В ней зафиксированы методы, параметры, multipart upload, типы ответов, raw-типы событий и отдельно отмеченные исторические live-наблюдения для исходного набора методов. Они не подтверждают live-проверку новых операций чатов.

## Ограничения

- Это интеграция для VK Teams / VK WorkSpace, не для `vk.com`.
- Входящие события работают через long polling, не через webhook.
- `VK Teams Trigger` скачивает вложения только из верхнего уровня `payload.parts`.
- `message.sendFile` и `message.sendVoice` пока не переиспользуют существующий `fileId`.
- Private/on-premise методы `chats/createChat` и `chats/members/add` не входят в текущую версию. Другие операции чатов не получают дополнительных прав: их проверяет сервер.
- Новые операции чатов и четыре новых события сверены с официальной спецификацией и SDK, но не проверены на реальном боте в рамках этого изменения.


## Разработка

```bash
npm install
npm test
npm run lint
npm run lint:types
npm run build
```

Эти проверки и `npm pack --dry-run` также запускаются в GitHub Actions для каждого pull request и изменений в `master`, без публикации пакета.

Для запуска локального n8n с hot reload:

```bash
npm run dev
```

Для проверки схемы на живом API без сохранения токена в репозитории:

```bash
VK_TEAMS_BASE_URL=https://api.example.com/bot/v1/ \
VK_TEAMS_BOT_TOKEN=... \
npm run lint:types:live
```

## Проверочный workflow

В репозитории сохранён переносимый draft-workflow для регрессионной проверки ноды:

- [`docs/workflows/vk-teams-node-verification.workflow.json`](docs/workflows/vk-teams-node-verification.workflow.json)

Отдельный [workflow управления чатами](docs/workflows/vk-teams-chat-verification.workflow.json) содержит четыре операции чтения, отключённые примеры изменений и отдельный Trigger без отправки сообщений.

Краткий runbook по импорту, повторному запуску и пересинхронизации артефакта лежит в [`docs/workflows/README.md`](docs/workflows/README.md).

## Лицензия

MIT
