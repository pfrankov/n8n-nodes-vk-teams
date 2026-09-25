// These cases compare missing SDK capabilities with their actual outgoing API contracts.
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeAction } from '../../nodes/VkTeams/actions/execute';

function run(action: string, input: Record<string, unknown>) {
	const calls: Array<{ method: string; endpoint: string; params: Record<string, unknown> }> = [];
	const response = { ok: true, msgId: '9007199254740993001', extra: 'kept' };
	return {
		calls,
		response,
		result: executeAction(
			{
				requestJson: async (request) => {
					calls.push(request);
					return response;
				},
				requestUpload: async (request) => {
					calls.push(request);
					return response;
				},
				downloadBinary: async () => {
					assert.fail('unexpected download');
				},
			},
			action,
			input,
		),
	};
}

for (const operation of ['sendText', 'sendFile', 'sendVoice']) {
	for (const sendMode of ['reply', 'forward']) {
		test(`${operation} supports ${sendMode} with exact string IDs`, async () => {
			const ids = ['9007199254740993123', '9007199254740993124'];
			const check = run(`message.${operation}`, {
				chatId: 'target',
				text: 'Ответ',
				fileSource: 'fileId',
				fileId: 'existing',
				sendMode,
				replyMsgIds: JSON.stringify(ids),
				forwardMsgIds: ids,
				forwardChatId: 'source',
			});
			await check.result;
			assert.equal(check.calls.length, 1);
			assert.equal(check.calls[0].method, 'GET');
			const params = check.calls[0].params;
			if (sendMode === 'reply') {
				assert.deepEqual(params.replyMsgId, ids);
				assert.equal(params.forwardChatId, undefined);
				assert.equal(params.forwardMsgId, undefined);
			} else {
				assert.equal(params.forwardChatId, 'source');
				assert.deepEqual(params.forwardMsgId, ids);
				assert.equal(params.replyMsgId, undefined);
			}
		});
	}
}
for (const operation of ['sendFile', 'sendVoice']) {
	test(`${operation} reuses fileId without a binary upload`, async () => {
		const check = run(`message.${operation}`, {
			chatId: 'chat',
			fileSource: 'fileId',
			fileId: 'old-file',
		});
		assert.deepEqual(await check.result, { json: check.response });
		assert.equal(check.calls[0].method, 'GET');
		assert.equal(check.calls[0].endpoint, `/messages/${operation}`);
		assert.equal(check.calls[0].params.fileId, 'old-file');
	});
}
test('callback supports alert and URL without downloading it', async () => {
	const check = run('callback.answerCallbackQuery', {
		queryId: 'q',
		text: 'ok',
		showAlert: true,
		url: 'https://example.test/path?a=1',
	});
	await check.result;
	assert.deepEqual(check.calls[0].params, {
		queryId: 'q',
		text: 'ok',
		showAlert: 'true',
		url: 'https://example.test/path?a=1',
	});
});
for (const op of ['sendText', 'editText', 'sendFile']) {
	test(`${op} sends structural format as one object`, async () => {
		const format = {
			bold: [{ offset: 0, length: 6 }],
			pre: [{ offset: 7, length: 4, code: 'js' }],
		};
		const check = run(`message.${op}`, {
			chatId: 'chat',
			msgId: 'm',
			text: 'Привет test',
			caption: 'Привет test',
			format: JSON.stringify(format),
			fileSource: 'fileId',
			fileId: 'file',
		});
		await check.result;
		assert.deepEqual(check.calls[0].params.format, format);
	});
}
const invalid: Array<[string, Record<string, unknown>]> = [
	['message.sendText', { sendMode: 'reply', replyMsgIds: [] }],
	['message.sendText', { sendMode: 'reply', replyMsgIds: [123] }],
	['message.sendText', { sendMode: 'reply', replyMsgIds: Array(1) }],
	['message.sendText', { sendMode: 'forward', forwardMsgIds: ['m'] }],
	['message.sendText', { sendMode: 'forward', forwardChatId: 'source', forwardMsgIds: [] }],
	['message.sendText', { sendMode: 'unknown' }],
	['message.sendText', { parseMode: 'HTML', format: { bold: [{ offset: 0, length: 1 }] } }],
	['message.sendText', { format: { bold: [{ offset: -1, length: 1 }] } }],
	['message.sendText', { format: { bold: [{ offset: 0, length: 0 }] } }],
	['message.sendText', { format: { bold: Array(1) } }],
	['message.sendText', { format: { surprise: [] } }],
	['message.sendText', { format: { link: [{ offset: 0, length: 1 }] } }],
	['message.sendText', { format: 'null' }],
	['message.sendText', { format: '[]' }],
	['callback.answerCallbackQuery', { showAlert: 'false' }],
	['callback.answerCallbackQuery', { url: 'javascript:alert(1)' }],
	['message.sendFile', { fileSource: 'fileId', fileId: '' }],
	['message.sendVoice', { fileSource: 'bad', fileId: 'file' }],
];
for (const [action, extra] of invalid) {
	test(`reject invalid SDK inputs before HTTP: ${action} ${JSON.stringify(extra)}`, async () => {
		const check = run(action, { chatId: 'chat', text: 'test', queryId: 'q', ...extra });
		await assert.rejects(check.result);
		assert.equal(check.calls.length, 0);
	});
}
for (const [operation, input, endpoint, params] of [
	[
		'add',
		{ chatId: 'chat', msgId: '9007199254740993123' },
		'/threads/add',
		{ chatId: 'chat', msgId: '9007199254740993123' },
	],
	[
		'autosubscribe',
		{ chatId: 'chat', enable: true, withExisting: false },
		'/threads/autosubscribe',
		{ chatId: 'chat', enable: 'true', withExisting: 'false' },
	],
	[
		'getSubscribers',
		{ threadId: 'thread', pageSize: 10 },
		'/threads/subscribers/get',
		{ threadId: 'thread', pageSize: 10 },
	],
	[
		'getSubscribers',
		{ threadId: 'thread', cursor: 'opaque/+==' },
		'/threads/subscribers/get',
		{ threadId: 'thread', cursor: 'opaque/+==' },
	],
] as const) {
	test(`thread.${operation} matches the official SDK request`, async () => {
		const check = run(`thread.${operation}`, input);
		await check.result;
		assert.equal(check.calls.length, 1);
		assert.equal(check.calls[0].endpoint, endpoint);
		assert.deepEqual(check.calls[0].params, params);
	});
}

for (const [operation, input] of [
	['add', { chatId: 'chat', msgId: 9007199254740992 }],
	['add', { chatId: '', msgId: 'm' }],
	['autosubscribe', { chatId: 'chat', enable: 'false' }],
	['autosubscribe', { chatId: 'chat', enable: true, withExisting: 'false' }],
	['autosubscribe', { chatId: 'chat', enable: null }],
	['getSubscribers', { threadId: 'thread' }],
	['getSubscribers', { threadId: 'thread', cursor: '' }],
	['getSubscribers', { threadId: 'thread', cursor: null }],
	['getSubscribers', { threadId: 'thread', pageSize: 0 }],
	['getSubscribers', { threadId: 'thread', pageSize: -1 }],
	['getSubscribers', { threadId: 'thread', pageSize: 1.5 }],
	['getSubscribers', { threadId: 'thread', pageSize: '10' }],
	['getSubscribers', { threadId: 'thread', pageSize: Infinity }],
	['getSubscribers', { threadId: 'thread', pageSize: Number.MAX_SAFE_INTEGER + 1 }],
	['getSubscribers', { threadId: null, pageSize: 10 }],
	['toString', {}],
	['__proto__', {}],
] as Array<[string, Record<string, unknown>]>) {
	test(`thread.${operation} rejects invalid input ${JSON.stringify(input)} before HTTP`, async () => {
		const check = run(`thread.${operation}`, input);
		await assert.rejects(check.result);
		assert.equal(check.calls.length, 0);
	});
}
for (const format of [
	{ bold: [{ offset: 0.5, length: 1 }] },
	{ bold: [{ offset: 0, length: Number.MAX_SAFE_INTEGER + 1 }] },
	{ bold: [null] },
	{ link: [{ offset: 0, length: 1, url: 'javascript:alert(1)' }] },
	{ pre: [{ offset: 0, length: 1, code: 1 }] },
	{ pre: [{ offset: 0, length: 1, language: 'js' }] },
	{ bold: [{ offset: 0, length: 1, userId: 'extra' }] },
	JSON.parse('{"__proto__":[]}'),
]) {
	test(`format rejects unsupported range fields: ${JSON.stringify(format)}`, async () => {
		const check = run('message.sendText', { chatId: 'chat', text: 'test', format });
		await assert.rejects(check.result);
		assert.equal(check.calls.length, 0);
	});
}
