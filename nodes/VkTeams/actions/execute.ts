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
					})
				: buildSendVoiceUploadRequest({
						chatId,
						fileName: input.binaryFile.fileName,
						fileContentType: input.binaryFile.mimeType,
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
			});
			break;
		case 'message.editText':
			request = buildEditTextRequest({
				chatId: requireString(input.chatId, 'chatId'),
				msgId: requireString(input.msgId, 'msgId'),
				text: requireString(input.text, 'text'),
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
