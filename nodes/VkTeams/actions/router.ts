import {
	buildAnswerCallbackQueryRequest,
	buildDeleteMessagesRequest,
	buildEditTextRequest,
	buildGetChatInfoRequest,
	buildGetFileInfoRequest,
	buildGetSelfRequest,
	buildSendFileUploadRequest,
	buildSendTextRequest,
	buildSendVoiceUploadRequest,
} from './requests';

const actionMap = {
	'bot.getSelf': {
		key: 'bot.getSelf',
		buildRequest: buildGetSelfRequest,
	},
	'message.sendText': {
		key: 'message.sendText',
		buildRequest: buildSendTextRequest,
	},
	'message.editText': {
		key: 'message.editText',
		buildRequest: buildEditTextRequest,
	},
	'message.deleteMessages': {
		key: 'message.deleteMessages',
		buildRequest: buildDeleteMessagesRequest,
	},
	'message.sendFile': {
		key: 'message.sendFile',
		buildRequest: buildSendFileUploadRequest,
	},
	'message.sendVoice': {
		key: 'message.sendVoice',
		buildRequest: buildSendVoiceUploadRequest,
	},
	'callback.answerCallbackQuery': {
		key: 'callback.answerCallbackQuery',
		buildRequest: buildAnswerCallbackQueryRequest,
	},
	'chat.getInfo': {
		key: 'chat.getInfo',
		buildRequest: buildGetChatInfoRequest,
	},
	'file.getInfo': {
		key: 'file.getInfo',
		buildRequest: buildGetFileInfoRequest,
	},
	'file.download': {
		key: 'file.download',
		buildRequest: buildGetFileInfoRequest,
	},
} as const;

export function resolveAction(resource: string, operation: string) {
	const key = `${resource}.${operation}` as keyof typeof actionMap;
	const action = actionMap[key];

	if (action === undefined) {
		throw new Error(`Unknown action: ${resource}.${operation}`);
	}

	return action;
}
