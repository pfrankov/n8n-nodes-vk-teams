export type SendRelation = {
	replyMsgId?: string[];
	forwardChatId?: string;
	forwardMsgId?: string[];
};

export function nonemptyString(value: unknown, field: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${field} must be a nonempty string`);
	}
	return value;
}

export function stringIds(value: unknown, field: string): string[] {
	let parsed = value;
	if (typeof parsed === 'string') {
		try {
			parsed = JSON.parse(parsed);
		} catch {
			throw new Error(`${field} must be a JSON array of string IDs`);
		}
	}
	if (!Array.isArray(parsed) || parsed.length === 0)
		throw new Error(`${field} must be a nonempty array of string IDs`);
	const ids = Array.from(parsed, (id) => nonemptyString(id, field));
	if (new Set(ids).size !== ids.length) throw new Error(`${field} must not contain duplicate IDs`);
	return ids;
}

export function sendRelation(input: Record<string, unknown>): SendRelation {
	const mode = input.sendMode === undefined ? 'none' : input.sendMode;
	switch (mode) {
		case 'none':
			return {};
		case 'reply':
			return { replyMsgId: stringIds(input.replyMsgIds, 'replyMsgIds') };
		case 'forward':
			return {
				forwardChatId: nonemptyString(input.forwardChatId, 'forwardChatId'),
				forwardMsgId: stringIds(input.forwardMsgIds, 'forwardMsgIds'),
			};
		default:
			throw new Error('sendMode must be none, reply or forward');
	}
}

export function fileSource(value: unknown): 'binary' | 'fileId' {
	if (value === undefined || value === 'binary') return 'binary';
	if (value === 'fileId') return 'fileId';
	throw new Error('fileSource must be binary or fileId');
}

export function booleanParam(value: unknown, field: string): string {
	if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean`);
	return String(value);
}

export function httpUrl(value: unknown, field: string): string {
	const text = nonemptyString(value, field);
	let url: URL;
	try {
		url = new URL(text);
	} catch {
		throw new Error(`${field} must be an absolute HTTP(S) URL`);
	}
	if (
		!['http:', 'https:'].includes(url.protocol) ||
		url.username ||
		url.password ||
		/\s/.test(text)
	) {
		throw new Error(`${field} must be an absolute HTTP(S) URL without credentials or whitespace`);
	}
	return text;
}

export function callbackOptions(input: Record<string, unknown>): {
	showAlert?: string;
	url?: string;
} {
	return {
		...(input.showAlert === undefined
			? {}
			: { showAlert: booleanParam(input.showAlert, 'showAlert') }),
		...(input.url === undefined || input.url === '' ? {} : { url: httpUrl(input.url, 'url') }),
	};
}
