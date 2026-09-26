// Exercise n8n normalization, per-item expressions, outgoing URLs and multipart data.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Expression, NodeHelpers } from 'n8n-workflow';
import type {
	IDataObject,
	INodeParameters,
	IHttpRequestOptions,
	IExecuteFunctions,
} from 'n8n-workflow';
import { VkTeams } from '../../nodes/VkTeams/VkTeams.node';
import { resolveAction } from '../../nodes/VkTeams/actions/router';
import { chatMethods } from '../../nodes/VkTeams/actions/chat.requests';

function execution(
	parameters: INodeParameters,
	items: IDataObject[] = [{}],
	continueOnFail = false,
) {
	const node = new VkTeams();
	const expression = new Expression('UTC');
	const normalized = NodeHelpers.getNodeParameters(
		node.description.properties,
		{
			resource: 'chat',
			chatId: 'chat&token=not-a-token',
			...parameters,
		},
		true,
		false,
		null,
		node.description,
	);
	assert.ok(normalized);
	const requests: URL[] = [];
	const response = { ok: true, members: [{ userId: 'one' }], cursor: 'next/+==', serverField: 1 };
	const context = {
		getInputData: () => items.map((json) => ({ json })),
		getCredentials: async () => ({
			baseUrl: 'https://myteam.example',
			accessToken: 'real-test-token',
		}),
		getNodeParameter(name: string, index: number, fallback?: unknown) {
			const value = normalized[name] ?? fallback;
			return typeof value === 'string' && value.startsWith('=')
				? expression.resolveSimpleParameterValue(value, { $json: items[index] } as never)
				: value;
		},
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequest: async (options: { url: string }) => {
				requests.push(new URL(options.url));
				return response;
			},
			assertBinaryData: () => ({
				id: 'stored-file',
				fileName: 'avatar.png',
				mimeType: 'image/png',
			}),
			getBinaryDataBuffer: async () => Buffer.from('avatar-test-bytes'),
		},
	} as never;
	return { node, context, normalized, requests, response };
}

const operations: Array<[string, INodeParameters, string, Record<string, string | string[]>]> = [
	['getInfo', {}, 'getInfo', {}],
	['getMembers', { cursor: 'page/+==' }, 'getMembers', { cursor: 'page/+==' }],
	['getAdmins', {}, 'getAdmins', {}],
	['getBlockedUsers', {}, 'getBlockedUsers', {}],
	['getPendingUsers', {}, 'getPendingUsers', {}],
	[
		'deleteMembers',
		{ members: '["one","two"]' },
		'members/delete',
		{ members: '[{"sn":"one"},{"sn":"two"}]' },
	],
	['setTitle', { title: 'Chat title' }, 'setTitle', { title: 'Chat title' }],
	['setAbout', { about: '' }, 'setAbout', { about: '' }],
	['setRules', { rules: '' }, 'setRules', { rules: '' }],
	[
		'sendActions',
		{ actions: ['typing', 'looking'] },
		'sendActions',
		{ actions: ['typing', 'looking'] },
	],
	['sendActions', { actions: [] }, 'sendActions', { actions: '' }],
	['blockUser', { userId: 'one' }, 'blockUser', { userId: 'one', delLastMessages: 'false' }],
	['unblockUser', { userId: 'one' }, 'unblockUser', { userId: 'one' }],
	[
		'resolvePending',
		{ userId: 'one', approve: true },
		'resolvePending',
		{ userId: 'one', approve: 'true' },
	],
	[
		'resolvePending',
		{ everyone: true, userId: 'stale-hidden-user', approve: false },
		'resolvePending',
		{ everyone: 'true', approve: 'false' },
	],
	['pinMessage', { msgId: '9007199254740993123' }, 'pinMessage', { msgId: '9007199254740993123' }],
	[
		'unpinMessage',
		{ msgId: '9007199254740993123' },
		'unpinMessage',
		{ msgId: '9007199254740993123' },
	],
];

for (const [operation, fields, endpoint, params] of operations) {
	test(`normalized chat.${operation} sends only the intended query`, async () => {
		const { node, context, requests, response } = execution({
			operation,
			...fields,
			text: 'hidden',
			token: 'ignored',
		});
		const result = await node.execute.call(context);
		assert.equal(requests.length, 1);
		assert.equal(requests[0].pathname, `/bot/v1/chats/${endpoint}`);
		const expected = { token: 'real-test-token', chatId: 'chat&token=not-a-token', ...params };
		assert.deepEqual(
			[...new Set(requests[0].searchParams.keys())].sort(),
			Object.keys(expected).sort(),
		);
		for (const [key, value] of Object.entries(expected)) {
			assert.deepEqual(
				requests[0].searchParams.getAll(key),
				Array.isArray(value) ? value : [value],
			);
		}
		assert.equal(requests[0].searchParams.getAll('token').length, 1);
		assert.deepEqual(result, [[{ json: response, pairedItem: { item: 0 } }]]);
	});
}

for (const value of ['={{ $json.members }}', '={{ JSON.stringify($json.members) }}']) {
	test(`member lists survive n8n expression normalization: ${value}`, async () => {
		const { node, context, normalized, requests } = execution(
			{ operation: 'deleteMembers', members: value },
			[{ members: ['first&token=ignored'] }, { members: ['second', 'third'] }],
		);
		assert.equal(normalized.members, value);
		await node.execute.call(context);
		assert.deepEqual(
			requests.map((url) => JSON.parse(url.searchParams.get('members')!)),
			[[{ sn: 'first&token=ignored' }], [{ sn: 'second' }, { sn: 'third' }]],
		);
	});
}

test('continueOnFail keeps item pairing and does not send an empty member list', async () => {
	const { node, context, requests } = execution(
		{ operation: 'deleteMembers', members: '={{ $json.members }}' },
		[{ members: [] }, { members: ['second'] }],
		true,
	);
	const result = await node.execute.call(context);
	assert.equal(requests.length, 1);
	assert.match(String(result[0][0].json.error), /at least one/);
	assert.deepEqual(
		result[0].map((item) => item.pairedItem),
		[{ item: 0 }, { item: 1 }],
	);
});

test('default resolvePending cannot silently act on all users', async () => {
	const { node, context, normalized, requests } = execution({ operation: 'resolvePending' });
	assert.equal(normalized.everyone, false);
	await assert.rejects(node.execute.call(context), /exactly one target/);
	assert.equal(requests.length, 0);
});

test('avatar goes through the binary storage helper and multipart image field', async (t) => {
	let uploaded = 0;
	const { node, context } = execution({ operation: 'setAvatar' });
	t.mock.method(
		(context as IExecuteFunctions).helpers,
		'httpRequest',
		async (options: IHttpRequestOptions) => {
			uploaded++;
			const url = new URL(options.url);
			assert.equal(url.pathname, '/bot/v1/chats/avatar/set');
			assert.equal(url.searchParams.get('chatId'), 'chat&token=not-a-token');
			assert.equal(url.searchParams.get('token'), 'real-test-token');
			assert.equal(options.method, 'POST');
			assert.ok(Buffer.isBuffer(options.body));
			const form = await new Response(new Uint8Array(options.body), {
				headers: options.headers as Record<string, string>,
			}).formData();
			assert.equal(form.get('file'), null);
			const image = form.get('image');
			assert.ok(image instanceof Blob);
			assert.equal(image.type, 'image/png');
			assert.equal(await image.text(), 'avatar-test-bytes');
			assert.deepEqual(Array.from(form.keys()), ['image']);
			return { ok: true, description: 'saved' };
		},
	);
	const result = await node.execute.call(context);
	assert.equal(uploaded, 1);
	assert.deepEqual(result[0][0].json, { ok: true, description: 'saved' });
});

test('chat operation selector, registry and builders cover the same bounded scope', () => {
	const props = new VkTeams().description.properties;
	const selector = props.find(
		(p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes('chat'),
	);
	assert.ok(selector);
	assert.equal(selector.default, 'getInfo');
	const options = selector.options as Array<{ value: string }>;
	assert.deepEqual(
		options.map((o) => `chat.${o.value}`).sort(),
		[...Object.keys(chatMethods), 'chat.setAvatar'].sort(),
	);
	for (const option of options)
		assert.equal(resolveAction(`chat.${option.value}`).key, `chat.${option.value}`);
	for (const op of ['createChat', 'addMembers', 'toString', '__proto__'])
		assert.throws(() => resolveAction(`chat.${op}`));
});

test('chat API permission failures are not returned as successful output', async () => {
	const { node, context, response, requests } = execution({ operation: 'getMembers' });
	Object.assign(response, { ok: false, description: 'Insufficient rights' });
	await assert.rejects(node.execute.call(context), /VK Teams API error: Insufficient rights/);
	assert.equal(requests.length, 1);
});

test('chat API errors honor Continue On Fail without retrying', async () => {
	const { node, context, response, requests } = execution({ operation: 'getMembers' }, [{}], true);
	Object.assign(response, { ok: false, description: 'Insufficient rights' });
	const result = await node.execute.call(context);
	assert.match(String(result[0][0].json.error), /Insufficient rights/);
	assert.deepEqual(result[0][0].pairedItem, { item: 0 });
	assert.equal(requests.length, 1);
});

// Exercise conditional fields with expressions and multiple items, not just UI literals.
test('resolvePending evaluates the target per item and never reads a hidden user expression', async () => {
	const { node, context, requests } = execution(
		{
			operation: 'resolvePending',
			everyone: '={{ $json.everyone }}',
			approve: '={{ $json.approve }}',
			userId: '={{ $json.userId.toLowerCase() }}',
		},
		[
			{ everyone: true, approve: false },
			{ everyone: false, approve: true, userId: 'TEST-USER' },
		],
	);
	const result = await node.execute.call(context);
	assert.equal(requests.length, 2);
	assert.equal(requests[0].searchParams.get('everyone'), 'true');
	assert.equal(requests[0].searchParams.has('userId'), false);
	assert.equal(requests[0].searchParams.get('approve'), 'false');
	assert.equal(requests[1].searchParams.has('everyone'), false);
	assert.equal(requests[1].searchParams.get('userId'), 'test-user');
	assert.equal(requests[1].searchParams.get('approve'), 'true');
	assert.deepEqual(
		result[0].map((item) => item.pairedItem),
		[{ item: 0 }, { item: 1 }],
	);
});

for (const field of ['everyone', 'approve']) {
	for (const invalid of [null, 'true', 'false', 1]) {
		test(`resolvePending rejects non-boolean ${field} expression (${JSON.stringify(invalid)})`, async () => {
			const { node, context, requests } = execution(
				{
					operation: 'resolvePending',
					everyone: false,
					approve: false,
					userId: 'user',
					[field]: '={{ $json.value }}',
				},
				[{ value: invalid }],
			);
			await assert.rejects(node.execute.call(context), /boolean/);
			assert.equal(requests.length, 0);
		});
	}
}

test('avatar transport failure honors Continue On Fail and preserves subsequent item pairing', async (t) => {
	const { node, context } = execution({ operation: 'setAvatar' }, [{}, {}], true);
	let calls = 0;
	t.mock.method((context as IExecuteFunctions).helpers, 'httpRequest', async () => {
		if (calls++ === 0) throw new Error('HTTP 413 Payload Too Large');
		return { ok: true };
	});
	const result = await node.execute.call(context);
	assert.equal(calls, 2);
	assert.match(String(result[0][0].json.error), /413/);
	assert.deepEqual(result[0][1].json, { ok: true });
	assert.deepEqual(
		result[0].map((item) => item.pairedItem),
		[{ item: 0 }, { item: 1 }],
	);
});
