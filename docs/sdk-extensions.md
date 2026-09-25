# Дополнения SDK в PR #4

Реализация расширяет проверенный коммит `9ac4be4`: Reply/Forward, GET-отправка по fileId, format, showAlert/url, три операции threads и опциональное сопоставление родительского чата в Trigger.

## Контракты

| Возможность | Источник | Отображение в n8n |
| --- | --- | --- |
| replyMsgId, forwardChatId, forwardMsgId | Официальные Python/Java SDK, messages/*.json | Send Mode; повторяющиеся query-ключи, строковые ID |
| GET sendFile/sendVoice | Официальные Python/Go SDK, сообщения GET/POST | File Source=File ID; binary остаётся по умолчанию |
| format | params.json#formatSchema, Python/Java | JSON объект, взаимоисключение parseMode; pre.code |
| showAlert/url | Java Messages.java, Python, answerCallbackQuery.json | Явный boolean и HTTP(S) URL, без скачивания URL |
| threads/add, autosubscribe, subscribers/get | Официальные Python/Go SDK и threads/*.json | Три операции, один запрос, без скрытых подписок |
| parent_topic | Go types.go/message.go | Только входящая метаинформация и опциональный фильтр |

Серверная документация получена 25 сентября 2026 года; это чтение публичных спецификаций, не вызовы методов на живом боте.

- Python: https://github.com/mail-ru-im/bot-python/blob/1da33b20ec89c90226bae90f12d5038e6a35803c/bot/bot.py
- Java: https://github.com/mail-ru-im/bot-java/blob/b0c165368d96d611d94276709205c8aba9deafb3/library/src/main/java/ru/mail/im/botapi/api/Messages.java
- Go: https://github.com/mail-ru-im/bot-golang/blob/343461642fb99b1317f815e1751f6b95b4d4e437/client.go
- Go event model: https://github.com/mail-ru-im/bot-golang/blob/343461642fb99b1317f815e1751f6b95b4d4e437/types.go
- Спецификация: https://teams.vk.com/botapi/api.yaml

## Сознательно не перенесено

Наличие в отдельном SDK не заменяет контракт: changedChatInfo пока не имеет проверенного payload; sendTextWithDeeplink отсутствует в публичном каталоге; request-id официально описан для логов, а не как гарантия идемпотентности. Исходящий parent_topic и серверная семантика удаления клавиатуры по [] не домысливаются. Private createChat/members/add остаются исключены. FSM/планировщики SDK не дублируются внутри n8n.

## Регрессия и эксплуатация

Новые проверки перед исправлением дали 33 падения, исходные 244 теста оставались зелёными. Тестируются реальные нормализация и выражения n8n, обе формы списка ID, multipart и GET, скрытые параметры, булевы значения подписки, страницы, некорректный format, сохранение raw event и отрицательные фильтры. Реальный сервер и UI n8n не запускались. [Ручной сценарий](workflows/README.md#дополнения-sdk) обязателен перед выпуском в конкретной инсталляции.

## SHA-256 полученных спецификаций

- `api.yaml`: `4f3eccd568a41eb15f6118eb22cfb5e92d8718749fccc2d81879d854ddf1dcab`
- `events/get.json`: `0912436eca1abb7fefce79290617fc5324c2d13765c91b2f88713a6a1f113789`
- `messages/answerCallbackQuery.json`: `d7aae8b4d79cfc0582c043fdf5e9f84911e86b93d2a594fc01d23845521e92b7`
- `messages/deleteMessages.json`: `8464f6af26c684d0448fe3c4c836558290944105d697a8e4e59bbec2f6721250`
- `messages/editText.json`: `54cb0265c88a429e9984608ac1ecaa71949751f30c2835aecd9b935189e1a0a6`
- `messages/sendFile.json`: `70955e5eec3a8d94adb0bc94058b21e690f52a196be23281bf27ab5c4021a72a`
- `messages/sendText.json`: `fbde8f7fd01567e26a6abd9d7cfaf10c883a0d58fd5b0617947fc533c5a512d3`
- `messages/sendVoice.json`: `788a46f59cd65e974d09217983f2bb6793314491c0a008cf5ef19afa95ece543`
- `params.json`: `458bb96c6988c4ec1333f89c01dc82325a50ddc3b91f6d8767e1113de692583a`
- `schemas.json`: `b16c278d0a25d2e5c679790be0f643605c638c33b3644d04b21b09b43f3d5004`
- `threads/add.json`: `08a39d78fd3af3c2269d1252d1a6fc0743ede75b40af7e8889be262555312ea8`
- `threads/autosubscribe.json`: `24db0eac994808a8733ea3afe1543a792ff467f410dc34dc736051b5bddf3e59`
- `threads/subscribersGet.json`: `16cde85ee0cde2bbd4efa9eca480e4855995528f056208a00da2c8b9bc91b29b`
