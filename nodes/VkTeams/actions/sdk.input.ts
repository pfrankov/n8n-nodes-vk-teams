import { readChatInput } from './chat.input';
import { fileSource } from './message.options';

type Read = (name: string, fallback?: unknown) => unknown;

export function readMessageExtensions(operation: string, read: Read): Record<string, unknown> {
	const input: Record<string, unknown> = {};
	if (operation !== 'editText') {
		input.sendMode = read('sendMode', 'none');
		if (input.sendMode === 'reply') input.replyMsgIds = read('replyMsgIds', '[]');
		if (input.sendMode === 'forward') {
			input.forwardChatId = read('forwardChatId', '');
			input.forwardMsgIds = read('forwardMsgIds', '[]');
		}
	}
	if (operation === 'sendFile' || operation === 'sendVoice') {
		input.fileSource = fileSource(read('fileSource', 'binary'));
		if (input.fileSource === 'fileId') input.fileId = read('fileId', '');
	}
	return input;
}

export function readFormatting(read: Read): Record<string, unknown> {
	const mode = read('formattingMode', 'parseMode');
	if (mode === 'json') return { format: read('formatJson', '{}') };
	if (mode === 'parseMode') return { parseMode: read('parseMode', '') };
	throw new Error('formattingMode must be parseMode or json');
}

export function readThreadInput(operation: string, read: Read): Record<string, unknown> {
	switch (operation) {
		case 'add':
			return { chatId: read('chatId'), msgId: read('msgId') };
		case 'autosubscribe':
			return {
				chatId: read('chatId'),
				enable: read('enable', false),
				withExisting: read('withExisting', false),
			};
		case 'getSubscribers': {
			const input = { threadId: read('threadId') };
			const pagination = read('paginationMode', 'firstPage');
			if (pagination === 'firstPage') return { ...input, pageSize: read('pageSize', 10) };
			if (pagination === 'cursor') return { ...input, cursor: read('cursor', '') };
			throw new Error('paginationMode must be firstPage or cursor');
		}
		default:
			throw new Error(`Unknown action: thread.${operation}`);
	}
}

function readKeyboard(read: Read): unknown {
	switch (read('keyboard', 'none')) {
		case 'none':
			return undefined;
		case 'inlineKeyboard':
			return read('inlineKeyboard', {});
		case 'inlineKeyboardJson':
			return read('inlineKeyboardJson', '[]');
		default:
			throw new Error('Unknown keyboard mode');
	}
}

function readMessageInput(operation: string, read: Read): Record<string, unknown> {
	const chatId = read('chatId');
	if (operation === 'deleteMessages') {
		const collection = read('messageIds') as { values?: Array<{ msgId: string }> };
		return { chatId, msgId: (collection.values ?? []).map((item) => item.msgId) };
	}
	const input = {
		chatId,
		...readMessageExtensions(operation, read),
		inlineKeyboardMarkup: readKeyboard(read),
	};
	if (operation === 'sendVoice') return input;
	if (operation === 'sendFile')
		return { ...input, caption: read('caption', ''), ...readFormatting(read) };
	return {
		...input,
		text: read('text'),
		...readFormatting(read),
		...(operation === 'editText' ? { msgId: read('msgId') } : {}),
	};
}

export function readActionInput(
	resource: string,
	operation: string,
	read: Read,
): Record<string, unknown> {
	switch (resource) {
		case 'message':
			return readMessageInput(operation, read);
		case 'chat':
			return readChatInput(operation, read);
		case 'thread':
			return readThreadInput(operation, read);
		case 'callback':
			return {
				queryId: read('queryId'),
				text: read('text', ''),
				showAlert: read('showAlert', false),
				url: read('callbackUrl', ''),
			};
		case 'file':
			return { fileId: read('fileId') };
		case 'bot':
			return {};
		default:
			throw new Error(`Unknown resource: ${resource}`);
	}
}
