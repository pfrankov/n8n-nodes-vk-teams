import { booleanParam, httpUrl, stringIds, stringValue } from '../shared/validation';
import { buildInlineKeyboardMarkup } from './keyboard';
import { messageFormat } from './message.format';

export type SendRelation = {
	replyMsgId?: string[];
	forwardChatId?: string;
	forwardMsgId?: string[];
};

export function sendRelation(input: Record<string, unknown>): SendRelation {
	const mode = input.sendMode === undefined ? 'none' : input.sendMode;
	switch (mode) {
		case 'none':
			return {};
		case 'reply':
			return { replyMsgId: stringIds(input.replyMsgIds, 'replyMsgIds') };
		case 'forward':
			return {
				forwardChatId: stringValue(input.forwardChatId, 'forwardChatId'),
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

export function textMessageOptions(input: Record<string, unknown>) {
	const format = messageFormat(input.format);
	const value = input.parseMode;
	const parseMode = value == null || value === '' ? undefined : value;
	if (parseMode !== undefined && parseMode !== 'HTML' && parseMode !== 'MarkdownV2')
		throw new Error('parseMode must be MarkdownV2 or HTML');
	if (format !== undefined && parseMode !== undefined)
		throw new Error('format and parseMode are mutually exclusive');
	return {
		parseMode,
		...(format === undefined ? {} : { format }),
		inlineKeyboardMarkup: buildInlineKeyboardMarkup(input.inlineKeyboardMarkup),
	};
}
