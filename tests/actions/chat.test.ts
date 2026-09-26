// Verify endpoint contracts, explicit destructive targets, and no requests after invalid input.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildChatRequest,
	buildSetChatAvatarRequest,
} from '../../nodes/VkTeams/actions/chat.requests';
import { executeAction } from '../../nodes/VkTeams/actions/execute';

const cases: Array<[string, Record<string, unknown>, string, Record<string, unknown>]> = [
	[
		'createChat',
		{ name: 'Новая группа', about: '', rules: '', members: [], public: false, defaultRole: 'member', joinModeration: false },
		'/chats/createChat',
		{ name: 'Новая группа', about: '', rules: '', public: 'false', defaultRole: 'member', joinModeration: 'false' },
	],
	[
		'createChat',
		{ name: 'Группа', members: ['one', 'two'], public: true, joinModeration: true, defaultRole: 'member' },
		'/chats/createChat',
		{ name: 'Группа', members: '[{"sn":"one"},{"sn":"two"}]', public: 'true', defaultRole: 'member', joinModeration: 'true' },
	],
	['addMembers', { members: ['one'] }, '/chats/members/add', { members: '[{"sn":"one"}]' }],
	['getMembers', {}, '/chats/getMembers', {}],
	['getMembers', { cursor: 'opaque/+==' }, '/chats/getMembers', { cursor: 'opaque/+==' }],
	['getAdmins', {}, '/chats/getAdmins', {}],
	['getBlockedUsers', {}, '/chats/getBlockedUsers', {}],
	['getPendingUsers', {}, '/chats/getPendingUsers', {}],
	[
		'deleteMembers',
		{ members: ['one@example.test', 'two@example.test'] },
		'/chats/members/delete',
		{ members: '[{"sn":"one@example.test"},{"sn":"two@example.test"}]' },
	],
	['setTitle', { title: 'Рабочая группа' }, '/chats/setTitle', { title: 'Рабочая группа' }],
	['setAbout', { about: '' }, '/chats/setAbout', { about: '' }],
	['setRules', { rules: '' }, '/chats/setRules', { rules: '' }],
	[
		'sendActions',
		{ actions: ['typing', 'looking'] },
		'/chats/sendActions',
		{ actions: ['typing', 'looking'] },
	],
	['sendActions', { actions: [] }, '/chats/sendActions', { actions: '' }],
	[
		'blockUser',
		{ userId: 'one', delLastMessages: false },
		'/chats/blockUser',
		{ userId: 'one', delLastMessages: 'false' },
	],
	[
		'blockUser',
		{ userId: 'one', delLastMessages: true },
		'/chats/blockUser',
		{ userId: 'one', delLastMessages: 'true' },
	],
	['unblockUser', { userId: 'one' }, '/chats/unblockUser', { userId: 'one' }],
	[
		'resolvePending',
		{ userId: 'one', approve: true },
		'/chats/resolvePending',
		{ userId: 'one', approve: 'true' },
	],
	[
		'resolvePending',
		{ everyone: true, approve: false },
		'/chats/resolvePending',
		{ everyone: 'true', approve: 'false' },
	],
	[
		'pinMessage',
		{ msgId: '9007199254740993123' },
		'/chats/pinMessage',
		{ msgId: '9007199254740993123' },
	],
	[
		'unpinMessage',
		{ msgId: '9007199254740993123' },
		'/chats/unpinMessage',
		{ msgId: '9007199254740993123' },
	],
];

for (const [operation, input, endpoint, params] of cases) {
	test(`chat.${operation}: ${JSON.stringify(input)}`, async () => {
		const expected = {
			requestType: 'json',
			method: 'GET',
			endpoint,
			params: operation === 'createChat' ? params : { chatId: 'chat', ...params },
		};
		assert.deepEqual(buildChatRequest(`chat.${operation}`, { chatId: 'chat', ...input }), expected);
		const calls: unknown[] = [];
		const response = { ok: true, extraServerField: 'preserved' };
		const result = await executeAction(
			{
				requestJson: async (request) => {
					calls.push(request);
					return response;
				},
				requestUpload: async () => {
					throw new Error('unexpected upload');
				},
				downloadBinary: async () => {
					throw new Error('unexpected download');
				},
			},
			`chat.${operation}`,
			{ chatId: 'chat', ...input },
		);
		assert.deepEqual(calls, [expected]);
		assert.equal(result.json, response);
	});
}

test('members expressions accept JSON strings without changing IDs or injecting parameters', () => {
	assert.deepEqual(
		buildChatRequest('chat.deleteMembers', {
			chatId: 'chat',
			members: '["a&token=not-a-token","b"]',
			token: 'ignored',
			everyone: true,
		}).params,
		{ chatId: 'chat', members: '[{"sn":"a&token=not-a-token"},{"sn":"b"}]' },
	);
});

const invalid: Array<[string, Record<string, unknown>]> = [
	['deleteMembers', { members: [] }],
	['deleteMembers', { members: '[]' }],
	['deleteMembers', { members: '{}' }],
	['deleteMembers', { members: 'not JSON' }],
	['deleteMembers', { members: [''] }],
	['deleteMembers', { members: ['   '] }],
	['deleteMembers', { members: [123] }],
	['deleteMembers', { members: [{ sn: 'one' }] }],
	['deleteMembers', { members: ['one', 'one'] }],
	['createChat', { name: '' }],
	['createChat', { name: 'Group', members: ['one', 'one'] }],
	['createChat', { name: 'Group', members: null }],
	['createChat', { name: 'Group', public: null }],
	['createChat', { name: 'Group', public: 'true' }],
	['createChat', { name: 'Group', joinModeration: 1 }],
	['addMembers', { members: [] }],
	['addMembers', { members: [123] }],
	['resolvePending', { approve: true }],
	['resolvePending', { approve: true, everyone: false }],
	['resolvePending', { approve: true, everyone: true, userId: 'one' }],
	['resolvePending', { approve: true, everyone: 'true' }],
	['resolvePending', { approve: 'false', userId: 'one' }],
	['resolvePending', { userId: 'one' }],
	['blockUser', { userId: 'one', delLastMessages: 'false' }],
	['blockUser', { userId: 'one', delLastMessages: null }],
	['blockUser', { userId: '' }],
	['setTitle', { title: '   ' }],
	['setAbout', { about: undefined }],
	['sendActions', { actions: ['recording'] }],
	['sendActions', { actions: 'typing' }],
	['pinMessage', { msgId: 9007199254740992 }],
	['toString', {}],
	['__proto__', {}],
];

for (const [operation, input] of invalid) {
	test(`reject chat.${operation} input ${JSON.stringify(input)} before HTTP`, async () => {
		let calls = 0;
		await assert.rejects(
			executeAction(
				{
					requestJson: async () => {
						calls++;
						return { ok: true };
					},
					requestUpload: async () => {
						calls++;
						return { ok: true };
					},
					downloadBinary: async () => {
						calls++;
						return Buffer.alloc(0);
					},
				},
				`chat.${operation}`,
				{ chatId: 'chat', ...input },
			),
		);
		assert.equal(calls, 0);
	});
}

test('every chat request requires an explicit nonempty chat ID', () => {
	for (const chatId of [undefined, '', '   ', 123, null]) {
		for (const [operation, input] of cases) {
			if (operation === 'createChat') continue;
			assert.throws(() => buildChatRequest(`chat.${operation}`, { ...input, chatId }));
		}
	}
});

test('avatar uploads use image multipart field and query chatId, not file', async () => {
	const file = { data: Buffer.from('image bytes'), fileName: 'avatar.png', mimeType: 'image/png' };
	const expected = {
		requestType: 'upload',
		method: 'POST',
		endpoint: '/chats/avatar/set',
		params: { chatId: 'chat' },
		fileField: 'image',
		fileName: 'avatar.png',
		fileContentType: 'image/png',
	};
	assert.deepEqual(
		buildSetChatAvatarRequest({
			chatId: 'chat',
			fileName: file.fileName,
			fileContentType: file.mimeType,
		}),
		expected,
	);
	let uploads = 0;
	await executeAction(
		{
			requestJson: async () => {
				throw new Error('unexpected JSON request');
			},
			requestUpload: async (request, binaryFile) => {
				uploads++;
				assert.deepEqual(request, expected);
				assert.equal(binaryFile, file);
				return { ok: true };
			},
			downloadBinary: async () => {
				throw new Error('unexpected download');
			},
		},
		'chat.setAvatar',
		{ chatId: 'chat', binaryFile: file },
	);
	assert.equal(uploads, 1);
});

test('missing avatar data must fail without HTTP', async () => {
	await assert.rejects(
		executeAction(
			{
				requestJson: async () => {
					assert.fail('unexpected JSON request');
				},
				requestUpload: async () => {
					assert.fail('unexpected upload');
				},
				downloadBinary: async () => {
					assert.fail('unexpected download');
				},
			},
			'chat.setAvatar',
			{ chatId: 'chat' },
		),
		/Binary data/,
	);
});
