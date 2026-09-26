# Проверка API для issue #1

Повторно проверено 25 сентября 2026 года относительно `master` пакета: `594f3c632c35e781e9fe595d61f5cb0e5a6b2d29`.

## Вывод и полезность

Перечисленные автором методы существуют в официальной спецификации и SDK; оснований считать их выдуманными нет. Исходный PR ограничивался автоматизациями существующих чатов. В следующей версии отдельно добавлены `chat.createChat` и `chat.addMembers` с явным предупреждением об ограниченной доступности. Их наличие в интерфейсе не означает доступ на конкретном сервере.

## Перекрёстные источники

1. Официальный Python SDK: [обычные методы](https://github.com/mail-ru-im/bot-python/blob/1da33b20ec89c90226bae90f12d5038e6a35803c/bot/bot.py), [отдельные Myteam-методы](https://github.com/mail-ru-im/bot-python/blob/1da33b20ec89c90226bae90f12d5038e6a35803c/bot/myteam.py), [события](https://github.com/mail-ru-im/bot-python/blob/1da33b20ec89c90226bae90f12d5038e6a35803c/bot/event.py).
2. Официальный Java SDK: [Chats](https://github.com/mail-ru-im/bot-java/blob/b0c165368d96d611d94276709205c8aba9deafb3/library/src/main/java/ru/mail/im/botapi/api/Chats.java), [действия looking/typing/пустое значение](https://github.com/mail-ru-im/bot-java/blob/b0c165368d96d611d94276709205c8aba9deafb3/library/src/main/java/ru/mail/im/botapi/entity/ChatAction.java), [тип участника](https://github.com/mail-ru-im/bot-java/blob/b0c165368d96d611d94276709205c8aba9deafb3/library/src/main/java/ru/mail/im/botapi/entity/Admin.java), [события](https://github.com/mail-ru-im/bot-java/blob/b0c165368d96d611d94276709205c8aba9deafb3/library/src/main/java/ru/mail/im/botapi/fetcher/event/).
3. Отдельная реализация: [async chat methods](https://github.com/Quakeer444/vk_teams_async_bot/blob/7d15e672b350592d070539d4ee1370f646f16205/vk_teams_async_bot/methods/chats.py), [ответы](https://github.com/Quakeer444/vk_teams_async_bot/blob/7d15e672b350592d070539d4ee1370f646f16205/vk_teams_async_bot/types/response.py), [события](https://github.com/Quakeer444/vk_teams_async_bot/blob/7d15e672b350592d070539d4ee1370f646f16205/vk_teams_async_bot/types/event.py).
4. При повторной проверке получены официальные [api.yaml](https://teams.vk.com/botapi/api.yaml), [params.json](https://teams.vk.com/botapi/params.json), [schemas.json](https://teams.vk.com/botapi/schemas.json) и JSON-описания всех 18 методов `/chats/` (включая уже поддерживаемый `getInfo`). В [createChat.json](https://teams.vk.com/botapi/chats/createChat.json) и [addMembers.json](https://teams.vk.com/botapi/chats/addMembers.json) явно указаны `im_tags: ["myteam_only"]` и `privateMethod`. В [sendActions.json](https://teams.vk.com/botapi/chats/sendActions.json) используется массив `params.json#actions`.
5. Официальный Go SDK: [SendChatActions и транспорт](https://github.com/mail-ru-im/bot-golang/blob/343461642fb99b1317f815e1751f6b95b4d4e437/client.go). Значения actions передаются через `url.Values` повторяющимися ключами, как и список в `requests` официального Python SDK.

SDK одного поставщика не являются независимыми экспериментами. В первой проверке размещённая документация не загрузилась; во второй её удалось получить через изолированный GitHub Actions runner. Выполнялись только GET-запросы к публичной документации, не вызовы Bot API. Тестового токена и endpoint не было. Сверка источников подтверждает контракт, но не права конкретного бота или доступность метода на каждом сервере.

## Матрица issue

| Метод | Свидетельства | Решение |
| --- | --- | --- |
| `chats/createChat` | Официальная спецификация: `myteam_only`/`privateMethod`; Python `myteam.py`; async SDK | `chat.createChat` с предупреждением о доступности |
| `chats/members/add` | Официальная спецификация: `myteam_only`/`privateMethod`; Python `myteam.py`; async SDK | `chat.addMembers` с предупреждением о доступности |
| `chats/members/delete` | Официальные Python + Java; async SDK | `chat.deleteMembers` |
| `chats/getMembers` | Официальные Python + Java; async SDK с cursor | `chat.getMembers`, одна страница |
| `chats/setTitle` | Официальные Python + Java; async SDK | `chat.setTitle` |
| `chats/sendActions` | Официальная спецификация; Python + Go используют повторяющиеся query-ключи | `chat.sendActions` |
| `chats/getAdmins` | Официальные Python + Java; async SDK | `chat.getAdmins` |
| `chats/getBlockedUsers` | Официальные Python + Java; async SDK | `chat.getBlockedUsers` |
| `chats/getPendingUsers` | Официальные Python + Java; async SDK | `chat.getPendingUsers` |
| `chats/blockUser` | Официальные Python + Java; async SDK | `chat.blockUser` |
| `chats/unblockUser` | Официальные Python + Java; async SDK | `chat.unblockUser` |
| `chats/resolvePending` | Официальные Python + Java; async SDK | `chat.resolvePending`, явный выбор цели |
| `chats/setAbout` | Официальные Python + Java; async SDK | `chat.setAbout` |
| `chats/setRules` | Официальные Python + Java; async SDK | `chat.setRules` |
| `chats/avatar/set` | Официальный Java + async SDK: POST, поле image | `chat.setAvatar` |
| `chats/pinMessage` | Официальные Python + Java; async SDK | `chat.pinMessage` |
| `chats/unpinMessage` | Официальные Python + Java; async SDK | `chat.unpinMessage` |

Приватность создания/добавления прямо обозначена в официальных JSON-описаниях (`myteam_only`, `privateMethod`), согласуется с выделением в `myteam.py` и подтверждается async SDK. Конкретный способ выдачи прав через серверную таблицу описан только третьим SDK и здесь не выдаётся за проверенную инструкцию для любой инсталляции. Наличие обёртки не доказывает доступность метода на каждом сервере; это проверяет сервер с учётом прав бота.

Четыре дополнительных события подтверждаются официальным `schemas.json`, обоими официальными SDK и async SDK. `newChatMembers` несёт `newMembers` и `addedBy`, `leftChatMembers` — `leftMembers` и `removedBy`, `pinnedMessage` — поле `from`; у `unpinnedMessage` пользователь не описан. Фильтр не подменяет инициатора затронутым участником и не пропускает событие без пользователя при активном user-фильтре.

## Границы и риск

Нет автоматического обхода страниц, повторов изменяющих запросов, синхронизации состава, обхода прав, скрытого выбора всех участников, смены credentials или внешних получателей. Удаление последних сообщений отключено по умолчанию. Аватар загружается из входного binary, а не по произвольному URL. В исходном PR не менялись версия пакета, публикация npm, workflow CI и настройки репозитория.

Восемь событий — поддерживаемый список этого пакета, не утверждение об исчерпывающем API: текущий официальный Python SDK также содержит `changedChatInfo` и методы threads, которые не входят в issue. Исторические live-наблюдения в общей OpenAPI-схеме относятся только к прежнему набору методов; новые методы помечены отдельно как contract-checked без live-проверки.

## Проверка перед выпуском

Автотесты проверяют все новые endpoint/параметры, нормализацию выражений n8n, multipart, негативные входы, парность items и фильтрацию событий. `npm run lint:types` сверяет UI/маршрутизацию и локальную схему; сами тесты не доказывают доступность методов у конкретного бота. Для этого нужен [отдельный тестовый чат и ручной сценарий](workflows/README.md#управление-чатами-и-события-состава).

## Замечания повторного ревью

- `sendActions` передавал несколько действий как один `typing,looking`; тест повторял это предположение стороннего SDK. Исправлено на `actions=typing&actions=looking` по двум официальным SDK и стандартной сериализации массива OpenAPI (`form`, `explode=true`). Снятие индикаторов по-прежнему отправляет один `actions=`. Тест проверяет `URLSearchParams.getAll`, а не `Object.fromEntries`, который теряет повторяющиеся ключи.
- Новый `Set Avatar` наследовал прямой `fetch` общего upload-helper. Он обходил сетевые проверки n8n и не проверял HTTP-статус. Загрузка аватара, файла и голосового теперь идёт через `context.helpers.httpRequest`, без fallback на `fetch`, без автоматических перенаправлений и с HTTP-таймаутом 300 секунд. Multipart кодирует стандартный `Response(FormData)`; n8n получает готовый Buffer и его Content-Type. Тело остаётся полностью буферизованным, а не потоковым. [Транспорт n8n](https://github.com/n8n-io/n8n/blob/4d5c66375dd82dd02677256d8a8d5bb1c86c0c3d/packages/@n8n/backend-network/src/http/axios/request.ts) применяет проверки адреса и прокси, принимает Buffer и отклоняет неуспешные HTTP-статусы по умолчанию.
- `null`, массивы, строки и ответы только с `error` могли пройти как успешный JSON. Теперь они отклоняются; документированные объекты без `ok` (`members`, `admins`, `users`, метаданные файла) и дополнительные поля сохранены.
- Разреженный массив из выражения мог пройти `map`/`some` и превратиться в `members=[null]` или пустую активность. Теперь пропущенный элемент валидируется как некорректный, до HTTP-запроса.
- В локальной схеме участника отсутствовал документированный флаг `admin`. Добавлен без удаления дополнительных полей ответа.

Новые проверки сначала воспроизвели ошибки на исходном PR: 20 падающих тестов при сохранении прежних 211 успешных. Отдельно добавлены проверки выражений Everyone/Approve по каждому item, ошибок binary storage и `Continue On Fail` при загрузке. Это повторное ревью того же изменения, не независимый апрув другого автора.

### Отпечатки официальной документации

Документы получены 25 сентября 2026 года. SHA-256 позволяет отличить проверенный текст от последующих обновлений на сервере. Файлы с ключами `tr{{...}}` — исходные шаблоны спецификации; переводы описаний не использовались как доказательство.

| Документ относительно `https://teams.vk.com/botapi/` | SHA-256 |
| --- | --- |
| `api.yaml` | `4f3eccd568a41eb15f6118eb22cfb5e92d8718749fccc2d81879d854ddf1dcab` |
| `params.json` | `458bb96c6988c4ec1333f89c01dc82325a50ddc3b91f6d8767e1113de692583a` |
| `schemas.json` | `b16c278d0a25d2e5c679790be0f643605c638c33b3644d04b21b09b43f3d5004` |
| `chats/addMembers.json` | `26866bfef35cf42e8df2cf2290f028a99aa69a01684d143e4533c2d18bf28f51` |
| `chats/blockUser.json` | `15807751c70dfbb48810b4a214d5837c854791e33f695abe4e7b50ae188d19b7` |
| `chats/createChat.json` | `079293c3c0b524c0f336e221c66294b38aa466ebfce214af93eb9fb5e773f1a7` |
| `chats/deleteMembers.json` | `c6fe8a72ebb474c0903b14172b871c8e91fcdf70ee6aec458f3c5f2fdacc9668` |
| `chats/getAdmins.json` | `276a9d8ea43462c68627fab3b54ae63d2a4d65400f78f1c0f30a0521c93c783b` |
| `chats/getBlockedUsers.json` | `f2719ebeb8acee7c88453ba5a315610697ee26a77d0e6d06bde81aff4e5a0784` |
| `chats/getInfo.json` | `8e8b1f2406748d9a5169cd169fe77693af24d64bc458c5b6ec4b80ccdb9f812f` |
| `chats/getMembers.json` | `820a78407ac1d1c5b7f2ab3cb141bffa46328ee9325646721d76f6ec55e603a9` |
| `chats/getPendingUsers.json` | `9deba47909302e892f884cc4db815da0f99c054980b4afe32c242bdc4be19445` |
| `chats/pinMessage.json` | `ab52c60acc7c2c0c1c13affc0c1361f3b701abff4bb3624d040e621611822875` |
| `chats/resolvePending.json` | `3b3e0b1fe19274a7d4be9e03642fb1484cc538c58d37b5a8cebb349929e4c76b` |
| `chats/sendActions.json` | `596c50b1add650bf20246af3d4adb4a5528033ad4c10d147bc121a7546621b04` |
| `chats/setAbout.json` | `c784259aaf6d76682388bdce76140d52fa52878d18954fb3ffbd7f083a96bbe7` |
| `chats/setAvatar.json` | `4ddebe8aac8d07cdbfc99bab6aef0f3cf7dd6371efc03022eca1bb71aa749263` |
| `chats/setRules.json` | `96ca5e5db7b7e1c4ca2576a897d5c6998a7ac3e433a807d27b28c9026bb32e64` |
| `chats/setTitle.json` | `53edffe5b904b1cff39be792d4838d4f71e4c51619ded97424ac987228724c49` |
| `chats/unblockUser.json` | `c0a1446fa97752ff537f784cf788a1cfd82aa03d09325b1992ca8c1158063f20` |
| `chats/unpinMessage.json` | `2c2de76f6198c176cb277caabdb983066ecc07053c6f30de10188e9d74566ce1` |
