// Exercise invalid destructive targets and both execution entry points before any I/O.
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeAction } from '../../nodes/VkTeams/actions/execute';
import { resolveAction } from '../../nodes/VkTeams/actions/router';
import { buildInlineKeyboardMarkup } from '../../nodes/VkTeams/actions/keyboard';

function capture(input: Record<string, unknown>, action = 'message.deleteMessages') {
	const calls: unknown[] = [];
	const deps = {
		requestJson: async (request: unknown) => {
			calls.push(request);
			return { ok: true };
		},
		requestUpload: async (request: unknown) => {
			calls.push(request);
			return { ok: true };
		},
		downloadBinary: async () => {
			calls.push('download');
			return Buffer.alloc(0);
		},
	};
	return { calls, result: executeAction(deps, action, input) };
}

for (const msgId of [
	[],
	[''],
	['   '],
	[null],
	[undefined],
	[123],
	[9007199254740992],
	['a', 'a'],
	Array(1),
]) {
	test(`deleteMessages rejects invalid IDs before HTTP: ${JSON.stringify(msgId)}`, async () => {
		const c = capture({ chatId: 'chat', msgId });
		await assert.rejects(c.result, /msgId/);
		assert.equal(c.calls.length, 0);
	});
}

for (const value of [Array(1), [Array(1)], [{ row: { buttons: Array(1) } }]]) {
	test(`sparse keyboard cannot silently omit a row or send a null button: ${JSON.stringify(value)}`, () => {
		assert.throws(() => buildInlineKeyboardMarkup(value), /Keyboard/);
	});
}

for (const [resource, operation, input] of [
	['message', 'sendFile', { chatId: 'chat', fileSource: 'fileId', fileId: 'stored' }],
	['message', 'sendVoice', { chatId: 'chat', fileSource: 'fileId', fileId: 'stored' }],
	['message', 'sendText', { chatId: 'chat', text: 'text', sendMode: 'reply', replyMsgIds: ['m'] }],
] as const) {
	test(`registered ${resource}.${operation} builder is the actual execution path`, async () => {
		const c = capture(input, `${resource}.${operation}`);
		await c.result;
		const builder = resolveAction(`${resource}.${operation}`).buildRequest as (
			value: unknown,
		) => unknown;
		assert.deepEqual(builder(input), c.calls[0]);
	});
}

test('missing download filename fails before requesting file bytes', async () => {
	let downloads = 0;
	await assert.rejects(
		executeAction(
			{
				requestJson: async () => ({ url: 'https://example.test/file' }),
				requestUpload: async () => assert.fail('unexpected upload'),
				downloadBinary: async () => {
					downloads++;
					return Buffer.alloc(0);
				},
			},
			'file.download',
			{ fileId: 'f' },
		),
		/filename/,
	);
	assert.equal(downloads, 0);
});

test('deletion retains the exact large ID and supports both the scalar and list forms', async () => {
	for (const msgId of ['9007199254740993123', ['9007199254740993123', 'm&token=other']]) {
		const c = capture({ chatId: 'chat', msgId });
		await c.result;
		assert.deepEqual(c.calls, [
			{
				requestType: 'json',
				method: 'GET',
				endpoint: '/messages/deleteMessages',
				params: { chatId: 'chat', msgId },
			},
		]);
	}
});

test('empty optional captions stay omitted for binary and fileId sources', async () => {
	for (const fileSource of ['binary', 'fileId']) {
		const c = capture(
			{
				chatId: 'chat',
				fileSource,
				fileId: 'f',
				caption: '',
				binaryFile: { data: Buffer.alloc(0), fileName: 'f', mimeType: 'text/plain' },
			},
			'message.sendFile',
		);
		await c.result;
		assert.equal('caption' in (c.calls[0] as { params: object }).params, false);
	}
});
