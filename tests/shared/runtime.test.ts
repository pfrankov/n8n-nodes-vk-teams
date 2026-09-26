import assert from 'node:assert/strict';
import test from 'node:test';

import {
	assertSuccessfulVkTeamsResponse,
	sendJsonRequest,
	sendUploadRequest,
} from '../../nodes/VkTeams/shared/runtime';

const credentials = {
	accessToken: 'token',
	baseUrl: 'https://myteam.example',
};

test('assertSuccessfulVkTeamsResponse rejects ok false API payloads', () => {
	assert.throws(
		() => assertSuccessfulVkTeamsResponse({ ok: false, description: 'Invalid token' }),
		/VK Teams API error: Invalid token/,
	);
});

test('assertSuccessfulVkTeamsResponse rejects description-only API payloads', () => {
	assert.throws(
		() => assertSuccessfulVkTeamsResponse({ description: 'Invalid token' }),
		/VK Teams API error: Invalid token/,
	);
});

test('assertSuccessfulVkTeamsResponse allows successful responses with description', () => {
	assert.deepEqual(assertSuccessfulVkTeamsResponse({ ok: true, description: 'done' }), {
		ok: true,
		description: 'done',
	});
});

test('sendJsonRequest rejects logical VK Teams API errors', async () => {
	await assert.rejects(
		sendJsonRequest(
			{
				helpers: {
					async httpRequest() {
						return { ok: false, description: 'Invalid token' };
					},
				},
			} as never,
			credentials,
			{
				method: 'GET',
				endpoint: '/self/get',
				params: {},
			},
		),
		/VK Teams API error: Invalid token/,
	);
});

test('only the documented Add Members partial result preserves ok=false failures', async () => {
	const response = { ok: false, failures: [{ id: 'one', error: 'user_already_added' }] };
	const context = { helpers: { httpRequest: async () => response } } as never;
	assert.equal(
		await sendJsonRequest(context, credentials, {
			method: 'GET', endpoint: '/chats/members/add', params: { chatId: 'chat' },
		}),
		response,
	);
	await assert.rejects(
		sendJsonRequest(context, credentials, { method: 'GET', endpoint: '/chats/getInfo', params: {} }),
		/VK Teams API error/,
	);
});

test('sendUploadRequest rejects logical VK Teams API errors', async () => {
	await assert.rejects(
		sendUploadRequest(
			{
				helpers: { httpRequest: async () => ({ ok: false, description: 'file too large' }) },
			} as never,
			credentials,
			{
				endpoint: '/messages/sendFile',
				params: { chatId: 'chat-1' },
				fileField: 'file',
				fileName: 'report.txt',
				fileContentType: 'text/plain',
			},
			{ data: Buffer.from('file'), fileName: 'report.txt', mimeType: 'text/plain' },
		),
		/VK Teams API error: file too large/,
	);
});

for (const response of [null, [], 'Login required', 42, false]) {
	test(`non-object API payload is not a successful result: ${JSON.stringify(response)}`, () => {
		assert.throws(() => assertSuccessfulVkTeamsResponse(response), /invalid response/i);
	});
}

test('an error-only API payload does not become successful output', () => {
	assert.throws(() => assertSuccessfulVkTeamsResponse({ error: 'Access denied' }), /Access denied/);
});

test('documented responses without ok remain valid and preserve additional fields', () => {
	for (const payload of [
		{ url: 'https://files.example/test', filename: 'file.txt' },
		{ members: [{ userId: 'user', admin: true }], cursor: 'opaque', serverField: 'retained' },
		{ admins: [], serverField: 'retained' },
		{ users: [] },
	])
		assert.equal(assertSuccessfulVkTeamsResponse(payload), payload);
});

for (const response of [{}, { ok: 'false' }, { ok: 0 }, { ok: null }]) {
	test(`malformed success flag or empty JSON is not a successful response: ${JSON.stringify(response)}`, () => {
		assert.throws(() => assertSuccessfulVkTeamsResponse(response), /invalid response/i);
	});
}

test('JSON requests keep credentials authoritative and disable redirect replays', async () => {
	let requests = 0;
	await sendJsonRequest(
		{
			helpers: {
				httpRequest: async (options: import('n8n-workflow').IHttpRequestOptions) => {
					requests++;
					assert.deepEqual(new URL(options.url).searchParams.getAll('token'), ['token']);
					assert.equal(options.disableFollowRedirect, true);
					assert.equal(options.timeout, 300_000);
					return { ok: true };
				},
			},
		} as never,
		credentials,
		{
			method: 'GET',
			endpoint: '/chats/setTitle',
			params: { chatId: 'c', title: 't', token: 'override' },
		},
	);
	assert.equal(requests, 1);
});
