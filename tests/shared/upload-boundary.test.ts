// Uploads must use n8n's network boundary, not fetch: policy errors and HTTP failures are fatal.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import type { IHttpRequestOptions } from 'n8n-workflow';
import { sendUploadRequest } from '../../nodes/VkTeams/shared/runtime';

const credentials = { accessToken: 'test-token', baseUrl: 'https://myteam.example' };
const fileBytes = Buffer.from([0, 255, 1, 13, 10, 34, 128]);

for (const [endpoint, fileField] of [
	['/chats/avatar/set', 'image'],
	['/messages/sendFile', 'file'],
	['/messages/sendVoice', 'file'],
]) {
	for (const storage of ['buffer', 'stream']) {
		test(`${endpoint} sends ${storage} bytes through the n8n helper`, async (t) => {
			t.mock.method(globalThis, 'fetch', async () => assert.fail('must not bypass n8n'));
			let calls = 0;
			const expected = { ok: true, serverField: 'retained' };
			const result = await sendUploadRequest(
				{
					helpers: {
						httpRequest: async (options: IHttpRequestOptions) => {
							calls++;
							const url = new URL(options.url);
							assert.equal(url.pathname, `/bot/v1${endpoint}`);
							assert.deepEqual(
								[...url.searchParams],
								[
									['token', 'test-token'],
									['chatId', 'chat&token=ignored'],
								],
							);
							assert.equal(options.method, 'POST');
							assert.equal(options.disableFollowRedirect, true);
							assert.equal(options.timeout, 300_000);
							assert.notEqual(options.ignoreHttpStatusErrors, true);
							assert.equal(options.json, true);
							assert.ok(Buffer.isBuffer(options.body));
							const multipart = await new Response(new Uint8Array(options.body), {
								headers: options.headers as Record<string, string>,
							}).formData();
							assert.deepEqual([...multipart.keys()], [fileField]);
							const file = multipart.get(fileField);
							assert.ok(file instanceof File);
							assert.equal(file.type, 'image/png');
							assert.deepEqual(Buffer.from(await file.arrayBuffer()), fileBytes);
							assert.equal(file.name, 'фото.png');
							return expected;
						},
					},
				} as never,
				credentials,
				{
					endpoint,
					params: { chatId: 'chat&token=ignored' },
					fileField,
					fileName: 'фото.png',
					fileContentType: 'image/png',
				},
				{
					data: storage === 'buffer' ? fileBytes : Readable.from([fileBytes]),
					fileName: 'фото.png',
					mimeType: 'image/png',
				},
			);
			assert.equal(calls, 1);
			assert.equal(result, expected);
		});
	}
}

for (const message of [
	'SSRF policy denied',
	'HTTP 413 Payload Too Large',
	'HTTP 502 Bad Gateway',
	'Request timed out',
]) {
	test(`upload propagates ${message} without fallback or retry`, async (t) => {
		t.mock.method(globalThis, 'fetch', async () => new Response('{"ok":true}'));
		let calls = 0;
		const failure = new Error(message);
		await assert.rejects(
			sendUploadRequest(
				{
					helpers: {
						httpRequest: async () => {
							calls++;
							throw failure;
						},
					},
				} as never,
				credentials,
				{
					endpoint: '/chats/avatar/set',
					params: { chatId: 'chat' },
					fileField: 'image',
					fileName: 'photo.png',
					fileContentType: 'image/png',
				},
				{ data: fileBytes, fileName: 'photo.png', mimeType: 'image/png' },
			),
			(error) => error === failure,
		);
		assert.equal(calls, 1);
	});
}

test('stream errors fail before any HTTP request', async (t) => {
	t.mock.method(globalThis, 'fetch', async () => assert.fail('no fetch fallback'));
	const failure = new Error('Binary storage read failed');
	const stream = Readable.from(
		(async function* () {
			yield fileBytes;
			throw failure;
		})(),
	);
	await assert.rejects(
		sendUploadRequest(
			{ helpers: { httpRequest: async () => assert.fail('no upload on read failure') } } as never,
			credentials,
			{
				endpoint: '/chats/avatar/set',
				params: { chatId: 'chat' },
				fileField: 'image',
				fileName: 'photo.png',
				fileContentType: 'image/png',
			},
			{ data: stream, fileName: 'photo.png', mimeType: 'image/png' },
		),
		(error) => error === failure,
	);
});
