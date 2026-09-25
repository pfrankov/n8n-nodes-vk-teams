import { booleanParam, stringValue } from '../shared/validation';

type Input = Record<string, unknown>;
function subscribers(input: Input): Record<string, unknown> {
	const params: Record<string, unknown> = { threadId: stringValue(input.threadId, 'threadId') };
	if (input.pageSize !== undefined) {
		if (!Number.isSafeInteger(input.pageSize) || (input.pageSize as number) <= 0)
			throw new Error('pageSize must be a positive safe integer');
		params.pageSize = input.pageSize;
	}
	if (input.cursor !== undefined && input.cursor !== '')
		params.cursor = stringValue(input.cursor, 'cursor');
	if (params.pageSize === undefined && params.cursor === undefined)
		throw new Error('pageSize or cursor is required');
	return params;
}

export const threadMethods: Record<
	string,
	{ endpoint: string; params(input: Input): Record<string, unknown> }
> = {
	'thread.add': {
		endpoint: '/threads/add',
		params: (input) => ({
			chatId: stringValue(input.chatId, 'chatId'),
			msgId: stringValue(input.msgId, 'msgId'),
		}),
	},
	'thread.autosubscribe': {
		endpoint: '/threads/autosubscribe',
		params: (input) => ({
			chatId: stringValue(input.chatId, 'chatId'),
			enable: booleanParam(input.enable, 'enable'),
			withExisting: booleanParam(
				input.withExisting === undefined ? false : input.withExisting,
				'withExisting',
			),
		}),
	},
	'thread.getSubscribers': { endpoint: '/threads/subscribers/get', params: subscribers },
};

export function buildThreadRequest(key: string, input: Input) {
	if (!Object.prototype.hasOwnProperty.call(threadMethods, key))
		throw new Error(`Unknown action: ${key}`);
	const definition = threadMethods[key];
	return {
		requestType: 'json' as const,
		method: 'GET' as const,
		endpoint: definition.endpoint,
		params: definition.params(input),
	};
}
