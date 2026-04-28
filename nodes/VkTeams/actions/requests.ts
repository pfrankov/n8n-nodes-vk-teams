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

type TextMessageOptions = {
	parseMode?: string;
	inlineKeyboardMarkup?: unknown;
};

type FileMessageOptions = TextMessageOptions & {
	caption?: string;
};

function compactParams(params: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
}

export function buildGetSelfRequest(): JsonRequest {
	return {
		requestType: 'json',
		method: 'GET',
		endpoint: '/self/get',
		params: {},
	};
}

export function buildSendTextRequest(input: {
	chatId: string;
	text: string;
} & TextMessageOptions): JsonRequest {
	return {
		requestType: 'json',
		method: 'GET',
		endpoint: '/messages/sendText',
		params: compactParams(input),
	};
}

export function buildEditTextRequest(input: {
	chatId: string;
	msgId: string;
	text: string;
} & TextMessageOptions): JsonRequest {
	return {
		requestType: 'json',
		method: 'GET',
		endpoint: '/messages/editText',
		params: compactParams(input),
	};
}

export function buildDeleteMessagesRequest(input: {
	chatId: string;
	msgId: string | string[];
}): JsonRequest {
	return {
		requestType: 'json',
		method: 'GET',
		endpoint: '/messages/deleteMessages',
		params: input,
	};
}

export function buildAnswerCallbackQueryRequest(input: {
	queryId: string;
	text?: string;
}): JsonRequest {
	return {
		requestType: 'json',
		method: 'GET',
		endpoint: '/messages/answerCallbackQuery',
		params: input,
	};
}

export function buildGetChatInfoRequest(input: { chatId: string }): JsonRequest {
	return {
		requestType: 'json',
		method: 'GET',
		endpoint: '/chats/getInfo',
		params: input,
	};
}

export function buildGetFileInfoRequest(input: { fileId: string }): JsonRequest {
	return {
		requestType: 'json',
		method: 'GET',
		endpoint: '/files/getInfo',
		params: input,
	};
}

export function buildSendFileUploadRequest(input: {
	chatId: string;
	fileName: string;
	fileContentType: string;
} & FileMessageOptions): UploadRequest {
	return {
		requestType: 'upload',
		method: 'POST',
		endpoint: '/messages/sendFile',
		params: compactParams({
			chatId: input.chatId,
			caption: input.caption,
			parseMode: input.parseMode,
			inlineKeyboardMarkup: input.inlineKeyboardMarkup,
		}),
		fileField: 'file',
		fileName: input.fileName,
		fileContentType: input.fileContentType,
	};
}

export function buildSendVoiceUploadRequest(input: {
	chatId: string;
	fileName: string;
	fileContentType: string;
	inlineKeyboardMarkup?: unknown;
}): UploadRequest {
	return {
		requestType: 'upload',
		method: 'POST',
		endpoint: '/messages/sendVoice',
		params: compactParams({
			chatId: input.chatId,
			inlineKeyboardMarkup: input.inlineKeyboardMarkup,
		}),
		fileField: 'file',
		fileName: input.fileName,
		fileContentType: input.fileContentType,
	};
}
