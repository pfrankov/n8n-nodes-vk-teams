// Wire expectations come from the official OpenAPI + Python/Go SDK, not the request builder.
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChatRequest } from '../../nodes/VkTeams/actions/chat.requests';
import { createJsonRequestOptions } from '../../nodes/VkTeams/shared/transport';

test('multiple chat actions use repeated query keys, not a comma-separated token', () => {
	const request = buildChatRequest('chat.sendActions', {
		chatId: 'chat',
		actions: ['typing', 'looking', 'typing'],
	});
	const options = createJsonRequestOptions({
		baseUrl: 'https://myteam.example',
		token: 'test-token',
		...request,
	});
	const query = new URL(options.url).searchParams;
	assert.deepEqual(query.getAll('actions'), ['typing', 'looking']);
});

test('clearing chat actions still sends one explicit empty actions parameter', () => {
	const request = buildChatRequest('chat.sendActions', { chatId: 'chat', actions: [] });
	const options = createJsonRequestOptions({
		baseUrl: 'https://myteam.example',
		token: 'test-token',
		...request,
	});
	assert.deepEqual(new URL(options.url).searchParams.getAll('actions'), ['']);
});

for (const input of [{ members: Array(1) }, { members: ['one', , 'two'] }]) {
	test(`sparse member arrays cannot become JSON null targets: ${JSON.stringify(input)}`, () => {
		assert.throws(() => buildChatRequest('chat.deleteMembers', { chatId: 'chat', ...input }));
	});
}

test('sparse actions cannot become a blank activity token', () => {
	assert.throws(() => buildChatRequest('chat.sendActions', { chatId: 'chat', actions: Array(1) }));
});
