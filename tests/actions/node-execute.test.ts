import assert from 'node:assert/strict';
import test from 'node:test';
import { VkTeams, readBinaryFile } from '../../nodes/VkTeams/VkTeams.node';

test('VkTeams description exposes clickable keyboard for supported message operations', () => {
	const node = new VkTeams();
	const parseMode = node.description.properties.find((property) => property.name === 'parseMode');
	const keyboard = node.description.properties.find((property) => property.name === 'keyboard');
	const inlineKeyboard = node.description.properties.find((property) => property.name === 'inlineKeyboard');
	const buttonFields =
		(((inlineKeyboard as { options?: Array<{ values?: Array<{ options?: Array<{ values?: unknown[] }> }> }> })
			.options?.[0].values?.[0].options?.[0].values as Array<{
			name?: string;
			displayOptions?: { show?: Record<string, string[]> };
		}>) ?? []);
	const callbackData = buttonFields.find((field) => field.name === 'callbackData');
	const url = buttonFields.find((field) => field.name === 'url');

	assert.equal(parseMode?.type, 'options');
	assert.deepEqual(parseMode?.displayOptions?.show, {
		operation: ['sendText', 'editText', 'sendFile'],
		resource: ['message'],
	});
	assert.equal(keyboard?.type, 'options');
	assert.deepEqual(keyboard?.displayOptions?.show, {
		operation: ['sendText', 'editText', 'sendFile', 'sendVoice'],
		resource: ['message'],
	});
	assert.equal(inlineKeyboard?.type, 'fixedCollection');
	assert.deepEqual(inlineKeyboard?.displayOptions?.show, {
		keyboard: ['inlineKeyboard'],
		operation: ['sendText', 'editText', 'sendFile', 'sendVoice'],
		resource: ['message'],
	});
	assert.deepEqual(callbackData?.displayOptions?.show, { buttonType: ['callbackData'] });
	assert.deepEqual(url?.displayOptions?.show, { buttonType: ['url'] });
});

test('readBinaryFile uses binary buffer when n8n stores data externally', async () => {
	const result = await readBinaryFile(
		{
			helpers: {
				assertBinaryData() {
					return {
						id: 'binary-1',
						fileName: 'report.txt',
						mimeType: 'text/plain',
					};
				},
				async getBinaryDataBuffer(itemIndex: number, binaryPropertyName: string) {
					assert.equal(itemIndex, 0);
					assert.equal(binaryPropertyName, 'data');
					return Buffer.from('file');
				},
			},
		} as never,
		0,
		'data',
	);

	assert.deepEqual(result.data, Buffer.from('file'));
	assert.equal(result.fileName, 'report.txt');
	assert.equal(result.mimeType, 'text/plain');
});

test('readBinaryFile fails when file name is missing', async () => {
	await assert.rejects(
		readBinaryFile(
			{
				helpers: {
					assertBinaryData() {
						return {
							data: Buffer.from('file').toString('base64'),
							mimeType: 'text/plain',
						};
					},
				},
			} as never,
			0,
			'data',
		),
		/fileName is required/,
	);
});

test('VkTeams execute forwards multiple msgIds for deleteMessages', async () => {
	const node = new VkTeams();
	let requestOptions: unknown;

	const context = {
		async getCredentials() {
			return {
				accessToken: 'token',
				baseUrl: 'https://myteam.example',
			};
		},
		getInputData() {
			return [{ json: {} }];
		},
		getNodeParameter(name: string) {
			if (name === 'resource') return 'message';
			if (name === 'operation') return 'deleteMessages';
			if (name === 'chatId') return 'chat-1';
			if (name === 'messageIds') {
				return {
					values: [{ msgId: '1' }, { msgId: '2' }],
				};
			}
			throw new Error(`Unexpected parameter ${name}`);
		},
		continueOnFail() {
			return false;
		},
		helpers: {
			async httpRequest(options: unknown) {
				requestOptions = options;
				return { ok: true };
			},
			async prepareBinaryData() {
				throw new Error('not used');
			},
			assertBinaryData() {
				throw new Error('not used');
			},
		},
	} as never;

	const result = await node.execute.call(context);

	assert.equal(
		(requestOptions as { url: string }).url,
		'https://myteam.example/bot/v1/messages/deleteMessages?token=token&chatId=chat-1&msgId=1&msgId=2',
	);
	assert.deepEqual(result, [[{ json: { ok: true }, pairedItem: { item: 0 } }]]);
});

test('VkTeams execute forwards parse mode and keyboard markup for sendText', async () => {
	const node = new VkTeams();
	let requestOptions: unknown;

	const context = {
		async getCredentials() {
			return {
				accessToken: 'token',
				baseUrl: 'https://myteam.example',
			};
		},
		getInputData() {
			return [{ json: {} }];
		},
		getNodeParameter(name: string) {
			if (name === 'resource') return 'message';
			if (name === 'operation') return 'sendText';
			if (name === 'chatId') return 'chat-1';
			if (name === 'text') return '<b>hello</b>';
			if (name === 'parseMode') return 'HTML';
			if (name === 'keyboard') return 'inlineKeyboard';
			if (name === 'inlineKeyboard') {
				return {
					rows: [
						{
							row: {
								buttons: [
									{
										text: 'OK',
										buttonType: 'callbackData',
										callbackData: 'ok',
										style: 'primary',
									},
									{
										text: 'Docs',
										buttonType: 'url',
										url: 'https://teams.vk.com/botapi/',
										style: 'base',
									},
								],
							},
						},
					],
				};
			}
			throw new Error(`Unexpected parameter ${name}`);
		},
		continueOnFail() {
			return false;
		},
		helpers: {
			async httpRequest(options: unknown) {
				requestOptions = options;
				return { ok: true, msgId: '1' };
			},
			async prepareBinaryData() {
				throw new Error('not used');
			},
			assertBinaryData() {
				throw new Error('not used');
			},
		},
	} as never;

	const result = await node.execute.call(context);

	assert.equal(
		(requestOptions as { url: string }).url,
		'https://myteam.example/bot/v1/messages/sendText?token=token&chatId=chat-1&text=%3Cb%3Ehello%3C%2Fb%3E&parseMode=HTML&inlineKeyboardMarkup=%5B%5B%7B%22text%22%3A%22OK%22%2C%22callbackData%22%3A%22ok%22%2C%22style%22%3A%22primary%22%7D%2C%7B%22text%22%3A%22Docs%22%2C%22url%22%3A%22https%3A%2F%2Fteams.vk.com%2Fbotapi%2F%22%2C%22style%22%3A%22base%22%7D%5D%5D',
	);
	assert.deepEqual(result, [[{ json: { ok: true, msgId: '1' }, pairedItem: { item: 0 } }]]);
});

test('VkTeams execute omits keyboard params when keyboard is none', async () => {
	const node = new VkTeams();
	let requestOptions: unknown;

	const context = {
		async getCredentials() {
			return {
				accessToken: 'token',
				baseUrl: 'https://myteam.example',
			};
		},
		getInputData() {
			return [{ json: {} }];
		},
		getNodeParameter(name: string) {
			if (name === 'resource') return 'message';
			if (name === 'operation') return 'sendText';
			if (name === 'chatId') return 'chat-1';
			if (name === 'text') return 'hello';
			if (name === 'parseMode') return '';
			if (name === 'keyboard') return 'none';
			throw new Error(`Unexpected parameter ${name}`);
		},
		continueOnFail() {
			return false;
		},
		helpers: {
			async httpRequest(options: unknown) {
				requestOptions = options;
				return { ok: true, msgId: '1' };
			},
			async prepareBinaryData() {
				throw new Error('not used');
			},
			assertBinaryData() {
				throw new Error('not used');
			},
		},
	} as never;

	await node.execute.call(context);

	assert.equal(
		(requestOptions as { url: string }).url,
		'https://myteam.example/bot/v1/messages/sendText?token=token&chatId=chat-1&text=hello',
	);
});
