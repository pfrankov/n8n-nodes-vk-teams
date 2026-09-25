import { buildThreadRequest, threadMethods } from './thread.requests';
import { buildChatRequest, buildSetChatAvatarRequest, chatMethods } from './chat.requests';
import {
	buildAnswerCallbackQueryRequest,
	buildDeleteMessagesRequest,
	buildEditTextRequest,
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
	'chat.setAvatar': { key: 'chat.setAvatar', buildRequest: buildSetChatAvatarRequest },
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
	const chatKey = `${resource}.${operation}`;
	if (Object.prototype.hasOwnProperty.call(threadMethods, chatKey))
		return {
			key: chatKey,
			buildRequest: (input: Record<string, unknown>) => buildThreadRequest(chatKey, input),
		};
	if (Object.prototype.hasOwnProperty.call(chatMethods, chatKey)) {
		return {
			key: chatKey,
			buildRequest: (input: Record<string, unknown>) => buildChatRequest(chatKey, input),
		};
	}
	const key = `${resource}.${operation}` as keyof typeof actionMap;
	const action = actionMap[key];

	if (action === undefined) {
		throw new Error(`Unknown action: ${resource}.${operation}`);
	}

	return action;
}
