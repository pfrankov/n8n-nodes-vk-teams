import assert from 'node:assert/strict';
import test from 'node:test';
import { VkTeams, readBinaryFile } from '../../nodes/VkTeams/VkTeams.node';

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
