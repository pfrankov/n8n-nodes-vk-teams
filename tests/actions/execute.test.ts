import assert from 'node:assert/strict';
import test from 'node:test';

import { executeAction } from '../../nodes/VkTeams/actions/execute';

test('executeAction sends text via json request', async () => {
	let capturedRequest: unknown;

	const result = await executeAction(
		{
			async requestJson(request: unknown) {
				capturedRequest = request;
				return { ok: true, msgId: '1' };
			},
			async requestUpload() {
				throw new Error('not used');
			},
			async downloadBinary() {
				throw new Error('not used');
			},
		},
		'message.sendText',
		{ chatId: 'chat-1', text: 'hello' },
	);

	assert.deepEqual(capturedRequest, {
		requestType: 'json',
		method: 'GET',
		endpoint: '/messages/sendText',
		params: { chatId: 'chat-1', text: 'hello' },
	});
	assert.deepEqual(result, { json: { ok: true, msgId: '1' } });
});

test('executeAction uploads file for sendFile', async () => {
	let capturedRequest: unknown;
	let capturedBinary: unknown;

	const result = await executeAction(
		{
			async requestJson() {
				throw new Error('not used');
			},
			async requestUpload(request: unknown, binaryFile: unknown) {
				capturedRequest = request;
				capturedBinary = binaryFile;
				return { ok: true, fileId: 'file-1', msgId: '2' };
			},
			async downloadBinary() {
				throw new Error('not used');
			},
		},
		'message.sendFile',
		{
			chatId: 'chat-1',
			binaryFile: {
				data: Buffer.from('file'),
				fileName: 'report.txt',
				mimeType: 'text/plain',
			},
		},
	);

	assert.deepEqual(capturedRequest, {
		requestType: 'upload',
		method: 'POST',
		endpoint: '/messages/sendFile',
		params: { chatId: 'chat-1' },
		fileField: 'file',
		fileName: 'report.txt',
		fileContentType: 'text/plain',
	});
	assert.deepEqual(capturedBinary, {
		data: Buffer.from('file'),
		fileName: 'report.txt',
		mimeType: 'text/plain',
	});
	assert.deepEqual(result, { json: { ok: true, fileId: 'file-1', msgId: '2' } });
});

test('executeAction downloads binary for file.download', async () => {
	const result = await executeAction(
		{
			async requestJson() {
				return {
					type: 'file',
					size: 4,
					filename: 'report.txt',
					url: 'https://download.example/report.txt',
				};
			},
			async requestUpload() {
				throw new Error('not used');
			},
			async downloadBinary(url: string) {
				assert.equal(url, 'https://download.example/report.txt');
				return Buffer.from('file');
			},
		},
		'file.download',
		{ fileId: 'file-1' },
	);

	assert.deepEqual(result, {
		json: {
			type: 'file',
			size: 4,
			filename: 'report.txt',
			url: 'https://download.example/report.txt',
		},
		binaryFile: {
			data: Buffer.from('file'),
			fileName: 'report.txt',
			mimeType: 'application/octet-stream',
		},
	});
});

test('executeAction fails when file.download response has no filename', async () => {
	await assert.rejects(
		executeAction(
			{
				async requestJson() {
					return {
						type: 'file',
						size: 4,
						url: 'https://download.example/report.txt',
					};
				},
				async requestUpload() {
					throw new Error('not used');
				},
				async downloadBinary() {
					return Buffer.from('file');
				},
			},
			'file.download',
			{ fileId: 'file-1' },
		),
		/filename is required/,
	);
});

test('executeAction fails when required text input is missing', async () => {
	await assert.rejects(
		executeAction(
			{
				async requestJson() {
					throw new Error('not used');
				},
				async requestUpload() {
					throw new Error('not used');
				},
				async downloadBinary() {
					throw new Error('not used');
				},
			},
			'message.sendText',
			{ chatId: 'chat-1' },
		),
		/text is required/,
	);
});
