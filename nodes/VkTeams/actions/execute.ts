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

type InputBinaryFile = {
	data: Buffer | NodeJS.ReadableStream;
	fileName: string;
	mimeType: string;
};

type OutputBinaryFile = {
	data: Buffer;
	fileName: string;
	mimeType: string;
};

type JsonRequest = {
	requestType: 'json';
	method: 'GET' | 'POST';
	endpoint: string;
	params: Record<string, unknown>;
};

type UploadRequest = {
	requestType: 'upload';
	method: 'POST';
	endpoint: string;
	params: Record<string, unknown>;
	fileField: string;
	fileName: string;
	fileContentType: string;
};

type ActionDependencies = {
	requestJson(request: JsonRequest): Promise<unknown>;
	requestUpload(request: UploadRequest, binaryFile: InputBinaryFile): Promise<unknown>;
	downloadBinary(url: string): Promise<Buffer>;
};

type ActionInput = Record<string, unknown> & {
	binaryFile?: InputBinaryFile;
};

type TextMessageOptions = {
	parseMode?: 'MarkdownV2' | 'HTML';
	inlineKeyboardMarkup?: unknown;
};

function requireString(value: unknown, name: string): string {
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`${name} is required`);
	}

	return value;
}

function requireOptionalString(value: unknown, name: string): string {
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`${name} is required`);
	}

	return value;
}

function optionalParseMode(value: unknown): TextMessageOptions['parseMode'] {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}

	if (value !== 'MarkdownV2' && value !== 'HTML') {
		throw new Error('parseMode must be MarkdownV2 or HTML');
	}

	return value;
}

function optionalString(value: unknown): string | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}

	return String(value);
}

function isEmptyMarkup(value: unknown): boolean {
	return (
		(Array.isArray(value) && value.length === 0) ||
		(typeof value === 'object' &&
			value !== null &&
			!Array.isArray(value) &&
			Object.keys(value).length === 0)
	);
}

function optionalInlineKeyboardMarkup(value: unknown): unknown {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}

	if (typeof value !== 'string') {
		return isEmptyMarkup(value) ? undefined : value;
	}

	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		throw new Error('inlineKeyboardMarkup must be valid JSON');
	}

	return isEmptyMarkup(parsed) ? undefined : parsed;
}

function textMessageOptions(input: ActionInput): TextMessageOptions {
	return {
		parseMode: optionalParseMode(input.parseMode),
		inlineKeyboardMarkup: optionalInlineKeyboardMarkup(input.inlineKeyboardMarkup),
	};
}

function keyboardOnlyOptions(input: ActionInput): Pick<TextMessageOptions, 'inlineKeyboardMarkup'> {
	return {
		inlineKeyboardMarkup: optionalInlineKeyboardMarkup(input.inlineKeyboardMarkup),
	};
}

export async function executeAction(
	deps: ActionDependencies,
	actionKey: string,
	input: ActionInput,
): Promise<{ json: unknown; binaryFile?: OutputBinaryFile }> {
	if (actionKey === 'file.download') {
		const fileId = requireString(input.fileId, 'fileId');
		const fileInfo = (await deps.requestJson({
			requestType: 'json',
			method: 'GET',
			endpoint: '/files/getInfo',
			params: { fileId },
		})) as {
			url: string;
			filename?: string;
		};
		const data = await deps.downloadBinary(fileInfo.url);

		return {
			json: fileInfo,
			binaryFile: {
				data,
				fileName: requireOptionalString(fileInfo.filename, 'filename'),
				mimeType: 'application/octet-stream',
			},
		};
	}

	if (actionKey === 'message.sendFile' || actionKey === 'message.sendVoice') {
		if (input.binaryFile === undefined) {
			throw new Error(`Binary data is required for ${actionKey}`);
		}

		const chatId = requireString(input.chatId, 'chatId');
		const request =
			actionKey === 'message.sendFile'
				? buildSendFileUploadRequest({
						chatId,
						fileName: input.binaryFile.fileName,
						fileContentType: input.binaryFile.mimeType,
						caption: optionalString(input.caption),
						...textMessageOptions(input),
					})
				: buildSendVoiceUploadRequest({
						chatId,
						fileName: input.binaryFile.fileName,
						fileContentType: input.binaryFile.mimeType,
						...keyboardOnlyOptions(input),
					});

		const json = await deps.requestUpload(request, input.binaryFile);
		return { json };
	}

	let request: JsonRequest;

	switch (actionKey) {
		case 'bot.getSelf':
			request = buildGetSelfRequest();
			break;
		case 'message.sendText':
			request = buildSendTextRequest({
				chatId: requireString(input.chatId, 'chatId'),
				text: requireString(input.text, 'text'),
				...textMessageOptions(input),
			});
			break;
		case 'message.editText':
			request = buildEditTextRequest({
				chatId: requireString(input.chatId, 'chatId'),
				msgId: requireString(input.msgId, 'msgId'),
				text: requireString(input.text, 'text'),
				...textMessageOptions(input),
			});
			break;
		case 'message.deleteMessages': {
			const msgId = input.msgId;
			request = buildDeleteMessagesRequest({
				chatId: requireString(input.chatId, 'chatId'),
				msgId: Array.isArray(msgId) ? msgId.map((value) => String(value)) : requireString(msgId, 'msgId'),
			});
			break;
		}
		case 'callback.answerCallbackQuery':
			request = buildAnswerCallbackQueryRequest({
				queryId: requireString(input.queryId, 'queryId'),
				text: input.text === undefined ? undefined : String(input.text),
			});
			break;
		case 'chat.getInfo':
			request = buildGetChatInfoRequest({
				chatId: requireString(input.chatId, 'chatId'),
			});
			break;
		case 'file.getInfo':
			request = buildGetFileInfoRequest({
				fileId: requireString(input.fileId, 'fileId'),
			});
			break;
		default:
			throw new Error(`Unknown action: ${actionKey}`);
	}

	const json = await deps.requestJson(request);
	return { json };
}
