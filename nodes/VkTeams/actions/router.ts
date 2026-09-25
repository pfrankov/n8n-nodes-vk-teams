import type { ActionInput, ActionRequest, BinaryFile } from '../shared/types';
import { stringIds, stringValue } from '../shared/validation';
import { buildThreadRequest, threadMethods } from './thread.requests';
import { buildChatRequest, buildSetChatAvatarRequest, chatMethods } from './chat.requests';
import { buildInlineKeyboardMarkup } from './keyboard';
import { callbackOptions, fileSource, sendRelation, textMessageOptions } from './message.options';
import {
	buildAnswerCallbackQueryRequest,
	buildDeleteMessagesRequest,
	buildEditTextRequest,
	buildGetFileInfoRequest,
	buildGetSelfRequest,
	buildSendFileUploadRequest,
	buildSendFileIdRequest,
	buildSendTextRequest,
	buildSendVoiceUploadRequest,
	buildSendVoiceIdRequest,
} from './requests';

function binaryFile(input: ActionInput): BinaryFile {
	if (!input.binaryFile) throw new Error('Binary data is required for upload');
	return input.binaryFile;
}

function sendFile(operation: 'sendFile' | 'sendVoice', input: ActionInput): ActionRequest {
	const common = {
		chatId: stringValue(input.chatId, 'chatId'),
		...sendRelation(input),
		...(operation === 'sendFile'
			? {
					caption:
						input.caption == null || input.caption === ''
							? undefined
							: stringValue(input.caption, 'caption', true),
					...textMessageOptions(input),
				}
			: { inlineKeyboardMarkup: buildInlineKeyboardMarkup(input.inlineKeyboardMarkup) }),
	};
	if (fileSource(input.fileSource) === 'fileId') {
		const params = { ...common, fileId: stringValue(input.fileId, 'fileId') };
		return operation === 'sendFile'
			? buildSendFileIdRequest(params)
			: buildSendVoiceIdRequest(params);
	}
	const file = binaryFile(input);
	const params = { ...common, fileName: file.fileName, fileContentType: file.mimeType };
	return operation === 'sendFile'
		? buildSendFileUploadRequest(params)
		: buildSendVoiceUploadRequest(params);
}

const actionMap: Record<string, (input: ActionInput) => ActionRequest> = {
	'bot.getSelf': buildGetSelfRequest,
	'message.sendText': (input) =>
		buildSendTextRequest({
			chatId: stringValue(input.chatId, 'chatId'),
			text: stringValue(input.text, 'text'),
			...sendRelation(input),
			...textMessageOptions(input),
		}),
	'message.editText': (input) =>
		buildEditTextRequest({
			chatId: stringValue(input.chatId, 'chatId'),
			msgId: stringValue(input.msgId, 'msgId'),
			text: stringValue(input.text, 'text'),
			...textMessageOptions(input),
		}),
	'message.deleteMessages': (input) =>
		buildDeleteMessagesRequest({
			chatId: stringValue(input.chatId, 'chatId'),
			msgId: Array.isArray(input.msgId)
				? stringIds(input.msgId, 'msgId')
				: stringValue(input.msgId, 'msgId'),
		}),
	'message.sendFile': (input) => sendFile('sendFile', input),
	'message.sendVoice': (input) => sendFile('sendVoice', input),
	'callback.answerCallbackQuery': (input) =>
		buildAnswerCallbackQueryRequest({
			queryId: stringValue(input.queryId, 'queryId'),
			text: input.text === undefined ? undefined : stringValue(input.text, 'text', true),
			...callbackOptions(input),
		}),
	'chat.setAvatar': (input) => {
		const file = binaryFile(input);
		return buildSetChatAvatarRequest({
			chatId: input.chatId,
			fileName: file.fileName,
			fileContentType: file.mimeType,
		});
	},
	'file.getInfo': (input) =>
		buildGetFileInfoRequest({ fileId: stringValue(input.fileId, 'fileId') }),
	'file.download': (input) =>
		buildGetFileInfoRequest({ fileId: stringValue(input.fileId, 'fileId') }),
};

export function resolveAction(key: string): {
	key: string;
	buildRequest(input: ActionInput): ActionRequest;
} {
	if (Object.prototype.hasOwnProperty.call(threadMethods, key))
		return { key, buildRequest: (input) => buildThreadRequest(key, input) };
	if (Object.prototype.hasOwnProperty.call(chatMethods, key))
		return { key, buildRequest: (input) => buildChatRequest(key, input) };
	if (!Object.prototype.hasOwnProperty.call(actionMap, key))
		throw new Error(`Unknown action: ${key}`);
	return { key, buildRequest: actionMap[key] };
}
