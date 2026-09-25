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

## Управление чатами и события состава

[`vk-teams-chat-verification.workflow.json`](vk-teams-chat-verification.workflow.json) — отдельное расширение матрицы. Существующий callback-workflow оставлен без изменений: его обработчики требуют `queryId`, поэтому подмешивать туда события состава нельзя.

При импорте workflow неактивен. Ручной запуск подключён только к четырём операциям чтения. Все изменяющие примеры отключены и не подключены к запуску; отдельный Trigger также отключён. Credentials и реальные ID не сохранены.

1. Назначьте `VK Teams API` и замените `REPLACE_WITH_TEST_CHAT_ID` в выбранных узлах на ID отдельного тестового чата. Проверьте права бота. Запустите чтение: `members`, `admins`, `users` должны остаться массивами в JSON. Для `Get Members` повторите вызов с полученным `cursor`; завершите обход при отсутствии курсора, пустой строке или `null`.
2. Для каждого нужного изменяющего примера заполните только тестовые ID, подключите отдельный Manual Trigger и включите только этот узел. Не соединяйте всю матрицу изменений в цепочку. `Set Avatar` требует входного binary-изображения; добавьте источник файла перед ним. Ответ `ok` сверяйте с фактическим состоянием чата.
3. `Delete Members`: удаляется только заданный непустой список. Пустой/некорректный список должен завершиться ошибкой до запроса. `Block User`: без удаления последних сообщений, пока это явно не включено. `Unblock User`: снимает блокировку тестового пользователя, но не обещает автоматически вернуть его в чат.
4. `Resolve Pending`: сначала обработайте одного тестового пользователя. Массовую обработку проверяйте только в отдельном пустом тестовом чате с контролируемыми заявками и явно включённым `Everyone`; `Approve=false` отклоняет их. Не применяйте к рабочему чату.
5. `Set Title`, `Set About`, `Set Rules`, `Set Avatar`: сохраните исходные значения и после проверки восстановите их отдельными действиями. Пустая строка в описании/правилах очищает поле. `Send Actions`: проверьте `typing` и `looking` отдельно и вместе, затем снимите индикатор пустым выбором. `Pin Message`/`Unpin Message`: используйте только сообщение тестового чата и строковый ID.
6. Для событий остановите другие consumers этого тестового бота, включите `Observe Chat Events` и активируйте workflow. Выполните добавление/выход участника и закрепление/снятие закрепления вручную в клиенте VK Teams. `Raw Event` должен сохранить полный исходный payload; эта ветка ничего не пишет в чат. После проверки отключите workflow.
7. В `Restrict To User IDs` проверьте `addedBy`/`removedBy`, а не участников из списков. `pinnedMessage` использует `from`. С непустым user-фильтром `unpinnedMessage` без пользователя не проходит; с пустым фильтром и правильным chatId проходит.

Доступность методов и права отличаются между серверами. Ошибки прав не следует обходить выдачей боту дополнительных привилегий без отдельного решения администратора. Для загрузок дополнительно проверьте конечный URL без перенаправления и настройки доступа n8n к серверу; ошибки HTTP/сети должны останавливать операцию, а `Continue On Fail` — сохранять ошибку в соответствующем item. Существующая матрица Send File/Send Voice также нужна для регрессии общего upload-helper.

Эти примеры не выполнялись на реальном Bot API в рамках PR; тестовые результаты в PR относятся к локальным проверкам и CI.

## Дополнения SDK

Импортируйте `vk-teams-sdk-extensions.workflow.json`. Все узлы, делающие API-запросы, отключены, workflow неактивен, credentials отсутствуют. Назначьте тестовые credentials и замените placeholder ID. Для проверки сообщений подключайте к Manual Trigger только один нужный пример и включайте его явно.

Проверьте Reply и Forward для одного и нескольких строковых ID; исходный chatId для Forward обязателен. Убедитесь, что в клиенте видна именно цитата/пересылка, а не только `ok`. Для `File ID` сначала получите ID вложения этого тестового сервера, затем отправьте его без binary. Повторите с голосовым, подписью и клавиатурой. `Format JSON` проверьте на русском тексте и тексте с emoji; диапазоны рассчитывает workflow, а не нода. `Show Alert` и URL callback проверяйте на свежем реальном queryId от кнопки.

Для полного цикла треда заполните родительский Chat ID и Message ID, включите только `Add Test Thread` и `Reply In Thread` в их отдельной ветке, затем запустите её. `Reply In Thread` использует возвращённый threadId, не ID группы. Отдельно настройте автоподписку бота, только если это нужно, без With Existing по умолчанию. Включите единственный Trigger этого бота с фильтром на ID родительской группы и Include Threads=true, ответьте в треде из клиента. Убедитесь, что событие приходит с собственным chatId треда и сохранённым parent_topic, чужой чат и неподходящий userId не проходят. С Include Threads=false фильтр остаётся точным по собственному chatId. По окончании выключите тестовый Trigger и восстановите подписку отдельным действием при необходимости.

Get Subscribers выполняет только один запрос. Проверьте первую страницу и последующий Cursor, не предполагая, что элементы имеют userId: у них sn. На сервере без поддержки тредов ошибка должна остаться ошибкой, без fallback на родительский чат и без повторного создания. Эти примеры не являются результатами live-проверки.

### Проверка ошибок перед выпуском

Для `Delete Messages` проверьте пустой список, числовой ID и дубли: HTTP-запроса быть не должно. ID больше `Number.MAX_SAFE_INTEGER` передавайте строкой. Проверьте повреждённую клавиатуру и `Continue On Fail`: ошибка относится только к своему item, следующий корректный item выполняется. `Base URL` должен вести прямо к API без HTTP-перенаправления; таймаут и сетевой запрет не должны вызывать повторные/обходные запросы.
