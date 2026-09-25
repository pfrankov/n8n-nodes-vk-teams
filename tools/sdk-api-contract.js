// Independent expectations from the official specification and Python/Go SDKs.
const ref = (name, path, params, response) => ({
	operationId: `thread.${name}`, n8nOperation: `thread.${name}`, path, method: 'get',
	params, successSchemas: [response], sourceEndpoint: path, sourceMethod: 'GET',
	actionKey: `thread.${name}`, source: 'thread',
});
const relation = ['replyMsgId', 'forwardChatId', 'forwardMsgId'];
module.exports = [
	ref('add', '/threads/add', ['token', 'chatId', 'msgId'], 'ThreadResponse'),
	ref('autosubscribe', '/threads/autosubscribe', ['token', 'chatId', 'enable', 'withExisting'], 'OkResponse'),
	ref('getSubscribers', '/threads/subscribers/get', ['token', 'threadId', 'pageSize', 'cursor'], 'ThreadSubscribersResponse'),
	...['sendFile', 'sendVoice'].map((name) => ({
		operationId: `message.${name}ById`, n8nOperation: `message.${name}`, path: `/messages/${name}`, method: 'get',
		params: ['token', 'chatId', 'fileId', ...(name === 'sendFile' ? ['caption'] : []), ...relation, 'inlineKeyboardMarkup', ...(name === 'sendFile' ? ['format', 'parseMode'] : [])],
		successSchemas: ['MessageResponse'], sourceEndpoint: `/messages/${name}`, sourceMethod: 'GET', actionKey: `message.${name}`,
	})),
];
