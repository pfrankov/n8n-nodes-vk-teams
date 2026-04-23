import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildAnswerCallbackQueryRequest,
	buildDeleteMessagesRequest,
	buildEditTextRequest,
	buildGetChatInfoRequest,
	buildGetFileInfoRequest,
	buildGetSelfRequest,
	buildSendFileUploadRequest,
	buildSendTextRequest,
	buildSendVoiceUploadRequest,
} from '../../nodes/VkTeams/actions/requests';

test('buildGetSelfRequest uses bot self endpoint', () => {
	assert.deepEqual(buildGetSelfRequest(), {
		requestType: 'json',
		method: 'GET',
		endpoint: '/self/get',
		params: {},
	});
});

test('buildSendTextRequest creates sendText endpoint and body', () => {
	assert.deepEqual(buildSendTextRequest({ chatId: 'chat-1', text: 'hello' }), {
		requestType: 'json',
		method: 'GET',
		endpoint: '/messages/sendText',
		params: { chatId: 'chat-1', text: 'hello' },
	});
});

test('buildEditTextRequest creates editText endpoint and body', () => {
	assert.deepEqual(buildEditTextRequest({ chatId: 'chat-1', msgId: '7', text: 'fixed' }), {
		requestType: 'json',
		method: 'GET',
		endpoint: '/messages/editText',
		params: { chatId: 'chat-1', msgId: '7', text: 'fixed' },
	});
});

test('buildDeleteMessagesRequest creates deleteMessages endpoint and body', () => {
	assert.deepEqual(buildDeleteMessagesRequest({ chatId: 'chat-1', msgId: '7' }), {
		requestType: 'json',
		method: 'GET',
		endpoint: '/messages/deleteMessages',
		params: { chatId: 'chat-1', msgId: '7' },
	});
});

test('buildDeleteMessagesRequest accepts multiple message ids', () => {
	assert.deepEqual(buildDeleteMessagesRequest({ chatId: 'chat-1', msgId: ['7', '8'] }), {
		requestType: 'json',
		method: 'GET',
		endpoint: '/messages/deleteMessages',
		params: { chatId: 'chat-1', msgId: ['7', '8'] },
	});
});

test('buildAnswerCallbackQueryRequest maps query id and text', () => {
	assert.deepEqual(buildAnswerCallbackQueryRequest({ queryId: 'q1', text: 'ok' }), {
		requestType: 'json',
		method: 'GET',
		endpoint: '/messages/answerCallbackQuery',
		params: { queryId: 'q1', text: 'ok' },
	});
});

test('buildGetChatInfoRequest uses chats getInfo endpoint', () => {
	assert.deepEqual(buildGetChatInfoRequest({ chatId: 'chat-1' }), {
		requestType: 'json',
		method: 'GET',
		endpoint: '/chats/getInfo',
		params: { chatId: 'chat-1' },
	});
});

test('buildGetFileInfoRequest uses files getInfo endpoint', () => {
	assert.deepEqual(buildGetFileInfoRequest({ fileId: 'file-1' }), {
		requestType: 'json',
		method: 'GET',
		endpoint: '/files/getInfo',
		params: { fileId: 'file-1' },
	});
});

test('buildSendFileUploadRequest creates upload definition', () => {
	assert.deepEqual(
		buildSendFileUploadRequest({
			chatId: 'chat-1',
			fileName: 'report.txt',
			fileContentType: 'text/plain',
		}),
		{
			requestType: 'upload',
			method: 'POST',
			endpoint: '/messages/sendFile',
			params: {
				chatId: 'chat-1',
			},
			fileField: 'file',
			fileName: 'report.txt',
			fileContentType: 'text/plain',
		},
	);
});

test('buildSendVoiceUploadRequest creates upload definition', () => {
	assert.deepEqual(
		buildSendVoiceUploadRequest({
			chatId: 'chat-1',
			fileName: 'voice.ogg',
			fileContentType: 'audio/ogg',
		}),
		{
			requestType: 'upload',
			method: 'POST',
			endpoint: '/messages/sendVoice',
			params: {
				chatId: 'chat-1',
			},
			fileField: 'file',
			fileName: 'voice.ogg',
			fileContentType: 'audio/ogg',
		},
	);
});
