import type { INodeProperties } from 'n8n-workflow';

const showMessage = {
	resource: ['message'],
};

const showCallback = {
	resource: ['callback'],
};

const showChat = {
	resource: ['chat'],
};

const showFile = {
	resource: ['file'],
};

const showBot = {
	resource: ['bot'],
};

export const vkTeamsProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Bot', value: 'bot' },
			{ name: 'Callback', value: 'callback' },
			{ name: 'Chat', value: 'chat' },
			{ name: 'File', value: 'file' },
			{ name: 'Message', value: 'message' },
		],
		default: 'message',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showBot },
		options: [{ name: 'Get Self', value: 'getSelf', action: 'Get bot self info' }],
		default: 'getSelf',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showCallback },
		options: [
			{
				name: 'Answer Callback Query',
				value: 'answerCallbackQuery',
				action: 'Answer a callback query',
			},
		],
		default: 'answerCallbackQuery',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showChat },
		options: [{ name: 'Get Info', value: 'getInfo', action: 'Get chat info' }],
		default: 'getInfo',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showFile },
		options: [
			{ name: 'Download', value: 'download', action: 'Download a file' },
			{ name: 'Get Info', value: 'getInfo', action: 'Get file info' },
		],
		default: 'getInfo',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showMessage },
			options: [
				{ name: 'Delete Messages', value: 'deleteMessages', action: 'Delete messages' },
				{ name: 'Edit Text', value: 'editText', action: 'Edit text in a message' },
			{ name: 'Send File', value: 'sendFile', action: 'Send a file' },
			{ name: 'Send Text', value: 'sendText', action: 'Send a text message' },
			{ name: 'Send Voice', value: 'sendVoice', action: 'Send a voice message' },
		],
		default: 'sendText',
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
				show: {
					operation: ['getInfo', 'sendText', 'sendFile', 'sendVoice', 'editText', 'deleteMessages'],
					resource: ['chat', 'message'],
				},
			},
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['sendText', 'editText'],
				resource: ['message'],
			},
		},
	},
	{
		displayName: 'Message ID',
		name: 'msgId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
				show: {
					operation: ['editText'],
					resource: ['message'],
				},
			},
		},
	{
		displayName: 'Message IDs',
		name: 'messageIds',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {
			values: [{ msgId: '' }],
		},
		required: true,
		displayOptions: {
			show: {
				operation: ['deleteMessages'],
				resource: ['message'],
			},
		},
		options: [
			{
				displayName: 'Message IDs',
				name: 'values',
				values: [
					{
						displayName: 'Message ID',
						name: 'msgId',
						type: 'string',
						default: '',
					},
				],
			},
		],
	},
	{
		displayName: 'Query ID',
		name: 'queryId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['answerCallbackQuery'],
				resource: ['callback'],
			},
		},
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['answerCallbackQuery'],
				resource: ['callback'],
			},
		},
	},
	{
		displayName: 'File ID',
		name: 'fileId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['getInfo', 'download'],
				resource: ['file'],
			},
		},
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions: {
			show: {
				operation: ['sendFile', 'sendVoice'],
				resource: ['message'],
			},
		},
	},
];
