import assert from 'node:assert/strict';
import test from 'node:test';

import { createJsonRequestOptions } from '../../nodes/VkTeams/shared/transport';

test('createJsonRequestOptions builds authenticated request config', () => {
	assert.deepEqual(
		createJsonRequestOptions({
			baseUrl: 'https://myteam.example/',
			token: 'secret',
			method: 'GET',
			endpoint: '/messages/sendText',
			params: { chatId: 'chat-1', text: 'hello' },
		}),
		{
			method: 'GET',
			url: 'https://myteam.example/bot/v1/messages/sendText?token=secret&chatId=chat-1&text=hello',
			json: true,
			disableFollowRedirect: true,
			timeout: 300_000,
		},
	);
});

test('createJsonRequestOptions omits empty params', () => {
	assert.deepEqual(
		createJsonRequestOptions({
			baseUrl: 'https://myteam.example',
			token: 'secret',
			method: 'GET',
			endpoint: '/self/get',
			params: {},
		}),
		{
			method: 'GET',
			url: 'https://myteam.example/bot/v1/self/get?token=secret',
			json: true,
			disableFollowRedirect: true,
			timeout: 300_000,
		},
	);
});

test('createJsonRequestOptions serializes arrays as repeated query parameters', () => {
	assert.deepEqual(
		createJsonRequestOptions({
			baseUrl: 'https://myteam.example',
			token: 'secret',
			method: 'GET',
			endpoint: '/messages/deleteMessages',
			params: { chatId: 'chat-1', msgId: ['7', '8'] },
		}),
		{
			method: 'GET',
			url: 'https://myteam.example/bot/v1/messages/deleteMessages?token=secret&chatId=chat-1&msgId=7&msgId=8',
			json: true,
			disableFollowRedirect: true,
			timeout: 300_000,
		},
	);
});

test('createJsonRequestOptions omits undefined optional parameters', () => {
	assert.deepEqual(
		createJsonRequestOptions({
			baseUrl: 'https://myteam.example',
			token: 'secret',
			method: 'GET',
			endpoint: '/messages/answerCallbackQuery',
			params: { queryId: 'query-1', text: undefined },
		}),
		{
			method: 'GET',
			url: 'https://myteam.example/bot/v1/messages/answerCallbackQuery?token=secret&queryId=query-1',
			json: true,
			disableFollowRedirect: true,
			timeout: 300_000,
		},
	);
});

test('createJsonRequestOptions serializes object params as JSON strings', () => {
	assert.deepEqual(
		createJsonRequestOptions({
			baseUrl: 'https://myteam.example',
			token: 'secret',
			method: 'GET',
			endpoint: '/messages/sendText',
			params: {
				chatId: 'chat-1',
				text: 'hello',
				format: {
					bold: [{ offset: 0, length: 5 }],
				},
			},
		}),
		{
			method: 'GET',
			url: 'https://myteam.example/bot/v1/messages/sendText?token=secret&chatId=chat-1&text=hello&format=%7B%22bold%22%3A%5B%7B%22offset%22%3A0%2C%22length%22%3A5%7D%5D%7D',
			json: true,
			disableFollowRedirect: true,
			timeout: 300_000,
		},
	);
});

test('createJsonRequestOptions serializes inline keyboard arrays as a single JSON string', () => {
	assert.deepEqual(
		createJsonRequestOptions({
			baseUrl: 'https://myteam.example',
			token: 'secret',
			method: 'GET',
			endpoint: '/messages/sendText',
			params: {
				chatId: 'chat-1',
				text: 'hello',
				inlineKeyboardMarkup: [[{ text: 'OK', callbackData: 'ok', style: 'primary' }]],
			},
		}),
		{
			method: 'GET',
			url: 'https://myteam.example/bot/v1/messages/sendText?token=secret&chatId=chat-1&text=hello&inlineKeyboardMarkup=%5B%5B%7B%22text%22%3A%22OK%22%2C%22callbackData%22%3A%22ok%22%2C%22style%22%3A%22primary%22%7D%5D%5D',
			json: true,
			disableFollowRedirect: true,
			timeout: 300_000,
		},
	);
});

test('POST query is encoded without creating an unused multipart descriptor', () => {
	const options = createJsonRequestOptions({
		baseUrl: 'https://myteam.example',
		token: 'secret',
		method: 'POST',
		endpoint: '/messages/sendFile',
		params: { chatId: 'chat-1' },
	});
	assert.equal(options.method, 'POST');
	assert.equal(
		options.url,
		'https://myteam.example/bot/v1/messages/sendFile?token=secret&chatId=chat-1',
	);
	assert.equal('formData' in options, false);
});
