// Run per-item expressions through n8n normalization before asserting wire-level parameters.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Expression, NodeHelpers } from 'n8n-workflow';
import type { IDataObject, INodeParameters, IHttpRequestOptions } from 'n8n-workflow';
import { VkTeams } from '../../nodes/VkTeams/VkTeams.node';
import { resolveAction } from '../../nodes/VkTeams/actions/router';
import { threadMethods } from '../../nodes/VkTeams/actions/thread.requests';
import { runLongPollRequest } from '../../nodes/VkTeamsTrigger/shared/longPoll';

function fixture(parameters: INodeParameters, items: IDataObject[] = [{}], continueOnFail = false) {
	const node = new VkTeams();
	const normalized = NodeHelpers.getNodeParameters(
		node.description.properties,
		parameters,
		true,
		false,
		null,
		node.description,
	)!;
	const expression = new Expression('UTC');
	const calls: IHttpRequestOptions[] = [];
	const reads: string[] = [];
	let binaryReads = 0;
	const context = {
		getInputData: () => items.map((json) => ({ json })),
		getCredentials: async () => ({
			baseUrl: 'https://api.example.test',
			accessToken: 'test-token',
		}),
		getNodeParameter(name: string, index: number, fallback?: unknown) {
			reads.push(name);
			const value = normalized[name] === undefined ? fallback : normalized[name];
			return typeof value === 'string' && value.startsWith('=')
				? expression.resolveSimpleParameterValue(value, { $json: items[index] } as never)
				: value;
		},
		continueOnFail: () => continueOnFail,
		helpers: {
			assertBinaryData: () => {
				binaryReads++;
				return {
					data: Buffer.from('test-bytes').toString('base64'),
					fileName: 'test.ogg',
					mimeType: 'audio/ogg',
				};
			},
			httpRequest: async (options: IHttpRequestOptions) => {
				calls.push(options);
				return new URL(options.url).pathname.endsWith('/threads/add')
					? { ok: true, threadId: 'thread-1@chat.agent' }
					: { ok: true, msgId: '9007199254740993001' };
			},
		},
	};
	return {
		node,
		normalized,
		calls,
		reads,
		binaryReads: () => binaryReads,
		execute: () => node.execute.call(context as never),
	};
}

for (const operation of ['sendText', 'sendFile', 'sendVoice']) {
	for (const source of operation === 'sendText' ? ['none'] : ['binary', 'fileId']) {
		test(`${operation}/${source}: reply/forward/none expressions keep per-item targets and ignore stale fields`, async () => {
			const f = fixture(
				{
					resource: 'message',
					operation,
					chatId: 'dest',
					text: 'Ответ',
					fileSource: source,
					fileId: 'existing',
					sendMode: '={{ $json.mode }}',
					replyMsgIds: '={{ $json.reply }}',
					forwardChatId: '={{ $json.source }}',
					forwardMsgIds: '={{ $json.forward }}',
				},
				[
					{
						mode: 'reply',
						reply: ['9007199254740993123', 'm&token=other'],
						source: 'ignored',
						forward: [123],
					},
					{ mode: 'forward', source: 'source', forward: ['one', 'two'], reply: null },
					{ mode: 'none', reply: [null], forward: [null] },
				],
			);
			const result = await f.execute();
			assert.equal(f.calls.length, 3);
			const queries = f.calls.map((call) => new URL(call.url).searchParams);
			assert.deepEqual(queries[0].getAll('replyMsgId'), ['9007199254740993123', 'm&token=other']);
			assert.equal(queries[0].has('forwardMsgId'), false);
			assert.deepEqual(queries[1].getAll('forwardMsgId'), ['one', 'two']);
			assert.equal(queries[1].get('forwardChatId'), 'source');
			assert.equal(queries[1].has('replyMsgId'), false);
			assert.equal(queries[2].has('replyMsgId') || queries[2].has('forwardMsgId'), false);
			for (const q of queries) assert.deepEqual(q.getAll('token'), ['test-token']);
			assert.deepEqual(
				result[0].map((item) => item.pairedItem),
				[{ item: 0 }, { item: 1 }, { item: 2 }],
			);
			assert.equal(f.binaryReads(), source === 'binary' ? 3 : 0);
		});
	}
}
for (const operation of ['sendFile', 'sendVoice']) {
	test(`${operation}: source expression selects one transport and never reads hidden source`, async () => {
		const f = fixture(
			{
				resource: 'message',
				operation,
				chatId: 'dest',
				fileSource: '={{ $json.source }}',
				fileId: '={{ $json.id }}',
			},
			[{ source: 'fileId', id: 'existing' }, { source: 'binary' }],
		);
		await f.execute();
		assert.deepEqual(
			f.calls.map((c) => c.method),
			['GET', 'POST'],
		);
		assert.equal(f.binaryReads(), 1);
		assert.equal(new URL(f.calls[0].url).searchParams.get('fileId'), 'existing');
		assert.equal(new URL(f.calls[1].url).searchParams.has('fileId'), false);
	});
	test(`${operation}: old workflow keeps binary source with newly added defaults`, async () => {
		const f = fixture({ resource: 'message', operation, chatId: 'dest' });
		await f.execute();
		assert.equal(f.calls[0].method, 'POST');
		assert.equal(f.binaryReads(), 1);
	});
}
for (const operation of ['sendText', 'editText', 'sendFile']) {
	test(`${operation}: format expressions are JSON serialized once and do not leak hidden parseMode`, async () => {
		const f = fixture(
			{
				resource: 'message',
				operation,
				chatId: 'dest',
				msgId: 'm',
				text: 'Я🙂 тест',
				caption: 'Я🙂 тест',
				fileSource: 'fileId',
				fileId: 'f',
				formattingMode: '={{ $json.mode }}',
				parseMode: '={{ $json.parse }}',
				formatJson: '={{ $json.format }}',
			},
			[
				{
					mode: 'json',
					format: { bold: [{ offset: 0, length: 1 }], pre: [{ offset: 3, length: 4, code: 'js' }] },
				},
				{ mode: 'parseMode', parse: 'HTML', format: 'invalid hidden' },
			],
		);
		await f.execute();
		const q1 = new URL(f.calls[0].url).searchParams;
		assert.equal(q1.has('parseMode'), false);
		assert.equal(q1.getAll('format').length, 1);
		assert.deepEqual(JSON.parse(q1.get('format')!), {
			bold: [{ offset: 0, length: 1 }],
			pre: [{ offset: 3, length: 4, code: 'js' }],
		});
		assert.equal(new URL(f.calls[1].url).searchParams.has('format'), false);
		assert.equal(new URL(f.calls[1].url).searchParams.get('parseMode'), 'HTML');
	});
}
test('callback per-item alert and URL are encoded, never fetched', async () => {
	const f = fixture(
		{
			resource: 'callback',
			operation: 'answerCallbackQuery',
			queryId: 'q',
			showAlert: '={{ $json.alert }}',
			callbackUrl: '={{ $json.url }}',
		},
		[
			{ alert: true, url: 'https://client.example.test/path?a=1&b=2' },
			{ alert: false, url: '' },
		],
	);
	await f.execute();
	assert.equal(f.calls.length, 2);
	assert.equal(new URL(f.calls[0].url).searchParams.get('showAlert'), 'true');
	assert.equal(new URL(f.calls[1].url).searchParams.get('showAlert'), 'false');
	assert.equal(new URL(f.calls[1].url).searchParams.has('url'), false);
	for (const call of f.calls) assert.equal(new URL(call.url).hostname, 'api.example.test');
});
test('bad member IDs fail only their own item without a transport fallback', async () => {
	const f = fixture(
		{
			resource: 'message',
			operation: 'sendText',
			chatId: 'dest',
			text: 'text',
			sendMode: 'reply',
			replyMsgIds: '={{ $json.ids }}',
		},
		[{ ids: [] }, { ids: ['one'] }],
		true,
	);
	const result = await f.execute();
	assert.equal(f.calls.length, 1);
	assert.match(String(result[0][0].json.error), /nonempty/);
	assert.deepEqual(result[0][1].pairedItem, { item: 1 });
});
test('thread pagination mode reads exactly one set of parameters', async () => {
	const f = fixture(
		{
			resource: 'thread',
			operation: 'getSubscribers',
			threadId: 'thread',
			paginationMode: '={{ $json.mode }}',
			pageSize: '={{ $json.size }}',
			cursor: '={{ $json.cursor }}',
		},
		[
			{ mode: 'firstPage', size: 10 },
			{ mode: 'cursor', cursor: 'opaque/+==', size: 'bad hidden value' },
		],
	);
	await f.execute();
	assert.equal(new URL(f.calls[0].url).searchParams.get('pageSize'), '10');
	assert.equal(new URL(f.calls[0].url).searchParams.has('cursor'), false);
	assert.equal(new URL(f.calls[1].url).searchParams.get('cursor'), 'opaque/+==');
	assert.equal(new URL(f.calls[1].url).searchParams.has('pageSize'), false);
});
test('thread autosubscription requires explicit booleans and does not enable existing threads by default', async () => {
	const f = fixture(
		{
			resource: 'thread',
			operation: 'autosubscribe',
			chatId: 'chat',
			enable: '={{ $json.enable }}',
		},
		[{ enable: 'true' }, { enable: true }],
		true,
	);
	const result = await f.execute();
	assert.equal(f.calls.length, 1);
	assert.match(String(result[0][0].json.error), /boolean/);
	assert.equal(new URL(f.calls[0].url).searchParams.get('withExisting'), 'false');
});
test('create thread, send to its chat ID and receive its event without losing parent fields', async () => {
	const add = fixture({
		resource: 'thread',
		operation: 'add',
		chatId: 'group',
		msgId: '9007199254740993123',
	});
	const created = (await add.execute())[0][0].json;
	const send = fixture(
		{
			resource: 'message',
			operation: 'sendText',
			chatId: '={{ $json.threadId }}',
			text: 'Thread reply',
		},
		[created],
	);
	await send.execute();
	assert.equal(new URL(send.calls[0].url).searchParams.get('chatId'), 'thread-1@chat.agent');
	const event = {
		eventId: 42,
		type: 'newMessage',
		payload: {
			chat: { chatId: 'thread-1@chat.agent' },
			from: { userId: 'u' },
			parent_topic: { chatId: 'group', messageId: 7, type: 'thread' },
			text: 'Ответ',
		},
	};
	const result = await runLongPollRequest(
		{
			fetchEvents: async () => [event],
			fetchFileInfo: async () => {
				assert.fail();
			},
			downloadBinary: async () => {
				assert.fail();
			},
		},
		{
			lastEventId: 0,
			pollTime: 60,
			allowedTypes: new Set(['message']),
			chatIds: new Set(['group']),
			includeThreads: true,
			downloadFiles: false,
		},
	);
	assert.deepEqual(result.items, [{ json: event }]);
	assert.equal(result.lastEventId, 42);
});
test('thread selector and router expose precisely three operations', () => {
	const selector = new VkTeams().description.properties.find(
		(p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes('thread'),
	)!;
	assert.equal(selector.default, 'getSubscribers');
	const operations = (selector.options as Array<{ value: string }>).map((item) => item.value);
	assert.deepEqual(
		operations.map((op) => `thread.${op}`).sort(),
		Object.keys(threadMethods).sort(),
	);
	for (const op of operations) assert.equal(resolveAction(`thread.${op}`).key, `thread.${op}`);
});

test('unknown keyboard mode fails closed instead of silently sending text without its buttons', async () => {
	const f = fixture({
		resource: 'message',
		operation: 'sendText',
		chatId: 'c',
		text: 't',
		keyboard: 'unknown-mode',
	});
	await assert.rejects(f.execute(), /keyboard/i);
	assert.equal(f.calls.length, 0);
});
