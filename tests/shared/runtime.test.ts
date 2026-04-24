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

test('sendUploadRequest rejects logical VK Teams API errors', async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (async (url, init) => {
		assert.equal(
			String(url),
			'https://myteam.example/bot/v1/messages/sendFile?token=token&chatId=chat-1',
		);
		assert.equal(init?.method, 'POST');
		assert.ok(init?.body instanceof FormData);

		return {
			async json() {
				return { ok: false, description: 'file too large' };
			},
		} as Response;
	}) as typeof fetch;

	try {
		await assert.rejects(
			sendUploadRequest(
				{} as never,
				credentials,
				{
					endpoint: '/messages/sendFile',
					params: { chatId: 'chat-1' },
					fileField: 'file',
					fileName: 'report.txt',
					fileContentType: 'text/plain',
				},
				{
					data: Buffer.from('file'),
					fileName: 'report.txt',
					mimeType: 'text/plain',
				},
			),
			/VK Teams API error: file too large/,
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
