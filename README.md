# n8n-nodes-vk-teams

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
- `file.getInfo`
- `file.download`

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

## Работа с файлами

`message.sendFile` и `message.sendVoice` берут файл из binary input предыдущего узла. Укажите `Input Binary Field`, в котором лежит файл.

`file.download` сначала получает метаданные через `file.getInfo`, затем скачивает файл и возвращает JSON с метаданными вместе с binary output.

## Схема API

OpenAPI-подобная схема поддерживаемого Bot API scope лежит в [`docs/vk-teams-bot-api.openapi.yaml`](docs/vk-teams-bot-api.openapi.yaml). В ней зафиксированы методы, параметры, multipart upload, типы ответов, raw-типы событий и live-наблюдения по реальному VK Teams endpoint.

## Ограничения

- Это интеграция для VK Teams / VK WorkSpace, не для `vk.com`.
- Входящие события работают через long polling, не через webhook.
- `VK Teams Trigger` скачивает вложения только из верхнего уровня `payload.parts`.
- `message.sendFile` и `message.sendVoice` пока не переиспользуют существующий `fileId`.
- Административные on-premise методы чатов не входят в текущую версию.


## Разработка

```bash
npm install
npm test
npm run lint
npm run lint:types
npm run build
```

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

Краткий runbook по импорту, повторному запуску и пересинхронизации артефакта лежит в [`docs/workflows/README.md`](docs/workflows/README.md).

## Лицензия

MIT
