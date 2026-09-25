import type { INodeProperties } from 'n8n-workflow';

const sending = { resource: ['message'], operation: ['sendText', 'sendFile', 'sendVoice'] };
const formatted = { resource: ['message'], operation: ['sendText', 'editText', 'sendFile'] };
const files = { resource: ['message'], operation: ['sendFile', 'sendVoice'] };

export const messageExtensionProperties: INodeProperties[] = [
	{
		displayName: 'Send Mode',
		name: 'sendMode',
		type: 'options',
		default: 'none',
		displayOptions: { show: sending },
		options: [
			{ name: 'None', value: 'none' },
			{ name: 'Reply', value: 'reply' },
			{ name: 'Forward', value: 'forward' },
		],
		description:
			'Reply and Forward are mutually exclusive. Hidden fields of other modes are ignored.',
	},
	{
		displayName: 'Reply Message IDs (JSON)',
		name: 'replyMsgIds',
		type: 'json',
		default: '[]',
		required: true,
		displayOptions: { show: { ...sending, sendMode: ['reply'] } },
		description:
			'Nonempty array of unique string IDs, for example ["123"]. Expressions can return an array.',
	},
	{
		displayName: 'Forward Chat ID',
		name: 'forwardChatId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { ...sending, sendMode: ['forward'] } },
		description: 'Source chat containing the messages to forward',
	},
	{
		displayName: 'Forward Message IDs (JSON)',
		name: 'forwardMsgIds',
		type: 'json',
		default: '[]',
		required: true,
		displayOptions: { show: { ...sending, sendMode: ['forward'] } },
		description:
			'Nonempty array of unique string IDs from Forward Chat ID. Do not convert IDs to numbers.',
	},
	{
		displayName: 'File Source',
		name: 'fileSource',
		type: 'options',
		default: 'binary',
		displayOptions: { show: files },
		options: [
			{ name: 'Binary', value: 'binary' },
			{ name: 'File ID', value: 'fileId' },
		],
		description: 'Upload binary data or reuse an existing file ID on the same VK Teams server',
	},
	{
		displayName: 'File ID',
		name: 'fileId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { ...files, fileSource: ['fileId'] } },
		description: 'Existing VK Teams file or voice ID. No binary data is read or uploaded.',
	},
	{
		displayName: 'Formatting',
		name: 'formattingMode',
		type: 'options',
		default: 'parseMode',
		displayOptions: { show: formatted },
		options: [
			{ name: 'Parse Mode', value: 'parseMode' },
			{ name: 'Format JSON', value: 'json' },
		],
		description: 'Use server text parsing or explicit format ranges, never both',
	},
	{
		displayName: 'Format (JSON)',
		name: 'formatJson',
		type: 'json',
		default: '{}',
		displayOptions: { show: { ...formatted, formattingMode: ['json'] } },
		description:
			'Bot API format object with offset/length ranges. Ranges are passed unchanged; use code for the optional pre language field.',
	},
	{
		displayName: 'Show Alert',
		name: 'showAlert',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['callback'], operation: ['answerCallbackQuery'] } },
		description: 'Whether to request an alert instead of a regular callback notification',
	},
	{
		displayName: 'Callback URL',
		name: 'callbackUrl',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['callback'], operation: ['answerCallbackQuery'] } },
		description: 'Optional HTTP(S) URL passed to the client; this node does not fetch it',
	},
];

export const threadProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getSubscribers',
		displayOptions: { show: { resource: ['thread'] } },
		options: [
			{ name: 'Add', value: 'add', action: 'Create a thread under a message' },
			{
				name: 'Autosubscribe',
				value: 'autosubscribe',
				action: 'Configure bot thread autosubscription',
			},
			{
				name: 'Get Subscribers',
				value: 'getSubscribers',
				action: 'Get one page of thread subscribers',
			},
		],
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['thread'], operation: ['add', 'autosubscribe'] } },
		description: 'Parent chat ID',
	},
	{
		displayName: 'Message ID',
		name: 'msgId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['thread'], operation: ['add'] } },
		description: 'String ID of the message to start a thread under',
	},
	{
		displayName: 'Enable',
		name: 'enable',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['thread'], operation: ['autosubscribe'] } },
		description:
			'Whether to enable bot autosubscription to threads. This is not a subscription for other users.',
	},
	{
		displayName: 'With Existing',
		name: 'withExisting',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['thread'], operation: ['autosubscribe'] } },
		description: 'Whether to include existing threads. Leave off unless explicitly needed.',
	},
	{
		displayName: 'Thread ID',
		name: 'threadId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['thread'], operation: ['getSubscribers'] } },
		description: 'Thread chat ID returned by Add',
	},
	{
		displayName: 'Pagination',
		name: 'paginationMode',
		type: 'options',
		default: 'firstPage',
		displayOptions: { show: { resource: ['thread'], operation: ['getSubscribers'] } },
		options: [
			{ name: 'First Page', value: 'firstPage' },
			{ name: 'Cursor', value: 'cursor' },
		],
		description: 'Returns one page only. Use the returned cursor for the next page.',
	},
	{
		displayName: 'Page Size',
		name: 'pageSize',
		type: 'number',
		typeOptions: { minValue: 1, numberPrecision: 0 },
		default: 10,
		displayOptions: {
			show: { resource: ['thread'], operation: ['getSubscribers'], paginationMode: ['firstPage'] },
		},
		description: 'Positive integer number of subscribers requested on the first page',
	},
	{
		displayName: 'Cursor',
		name: 'cursor',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['thread'], operation: ['getSubscribers'], paginationMode: ['cursor'] },
		},
		description: 'Opaque nonempty cursor from the previous response; do not modify it',
	},
];
