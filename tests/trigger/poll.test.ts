import assert from 'node:assert/strict';
import test from 'node:test';

import { runLongPollRequest } from '../../nodes/VkTeamsTrigger/shared/longPoll';

test('runLongPollRequest returns matching items and updates last event id', async () => {
	const result = await runLongPollRequest(
		{
			async fetchEvents() {
				return [
					{
						eventId: '41',
						type: 'message',
						payload: {
							text: 'hi',
							chat: { chatId: 'chat-1' },
							from: { userId: 'user-1' },
						},
					},
				];
			},
			async fetchFileInfo() {
				throw new Error('not used');
			},
			async downloadBinary() {
				throw new Error('not used');
			},
		},
		{
			lastEventId: 40,
			pollTime: 15,
			allowedTypes: new Set(['message']),
			downloadFiles: false,
		},
	);

	assert.equal(result.lastEventId, 41);
	assert.equal(result.items.length, 1);
	assert.deepEqual(result.items[0], {
		json: {
			eventId: '41',
			type: 'message',
			payload: {
				text: 'hi',
				chat: { chatId: 'chat-1' },
				from: { userId: 'user-1' },
			},
		},
	});
});

test('runLongPollRequest applies chat and user filters', async () => {
	const result = await runLongPollRequest(
		{
			async fetchEvents() {
				return [
					{
						eventId: '41',
						type: 'message',
						payload: {
							chat: { chatId: 'chat-2' },
							from: { userId: 'user-1' },
						},
					},
				];
			},
			async fetchFileInfo() {
				throw new Error('not used');
			},
			async downloadBinary() {
				throw new Error('not used');
			},
		},
		{
			lastEventId: 40,
			pollTime: 15,
			allowedTypes: new Set(['message']),
			chatIds: new Set(['chat-1']),
			userIds: new Set(['user-1']),
			downloadFiles: false,
		},
	);

	assert.equal(result.lastEventId, 41);
	assert.equal(result.items.length, 0);
});

test('runLongPollRequest downloads file parts when enabled', async () => {
	const result = await runLongPollRequest(
		{
			async fetchEvents() {
				return [
					{
						eventId: '41',
						type: 'message',
						payload: {
							chat: { chatId: 'chat-1' },
							from: { userId: 'user-1' },
							parts: [
								{
									type: 'file',
									payload: {
										fileId: 'file-1',
									},
								},
							],
						},
					},
				];
			},
			async fetchFileInfo(fileId: string) {
				assert.equal(fileId, 'file-1');
				return {
					url: 'https://download.example/file-1',
					filename: 'report.txt',
				};
			},
			async downloadBinary(url: string) {
				assert.equal(url, 'https://download.example/file-1');
				return Buffer.from('file');
			},
		},
		{
			lastEventId: 40,
			pollTime: 15,
			allowedTypes: new Set(['message']),
			downloadFiles: true,
		},
	);

	assert.equal(result.items.length, 1);
	assert.deepEqual(result.items[0].binaryFiles, [
		{
			propertyName: 'file_0',
			data: Buffer.from('file'),
			fileName: 'report.txt',
			mimeType: 'application/octet-stream',
		},
	]);
});

test('runLongPollRequest fails when file info has no filename', async () => {
	await assert.rejects(
		runLongPollRequest(
			{
				async fetchEvents() {
					return [
						{
							eventId: '41',
							type: 'message',
							payload: {
								chat: { chatId: 'chat-1' },
								from: { userId: 'user-1' },
								parts: [
									{
										type: 'file',
										payload: {
											fileId: 'file-1',
										},
									},
								],
							},
						},
					];
				},
				async fetchFileInfo() {
					return {
						url: 'https://download.example/file-1',
					};
				},
				async downloadBinary() {
					return Buffer.from('file');
				},
			},
			{
				lastEventId: 40,
				pollTime: 15,
				allowedTypes: new Set(['message']),
				downloadFiles: true,
			},
		),
		/filename is required/,
	);
});
