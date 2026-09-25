// Thread parent matching is explicitly opt-in and must not broaden existing user filters.
import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesEventFilters } from '../../nodes/VkTeamsTrigger/shared/filters';
const event = {
	type: 'newMessage',
	payload: {
		chat: { chatId: 'thread' },
		parent_topic: { chatId: 'group', messageId: 42, type: 'thread' },
		from: { userId: 'one' },
	},
};
test('parent chat filter only includes threads when explicitly enabled', () => {
	assert.equal(matchesEventFilters(event, { chatIds: new Set(['group']) }), false);
	const filters = { chatIds: new Set(['group']), includeThreads: true };
	assert.equal(matchesEventFilters(event, filters), true);
	assert.equal(matchesEventFilters(event, { ...filters, chatIds: new Set(['other']) }), false);
	assert.equal(matchesEventFilters(event, { ...filters, userIds: new Set(['other']) }), false);
});

test('nested callback thread metadata matches parent without weakening user filter', () => {
	const callback = {
		type: 'callbackQuery',
		payload: {
			from: { userId: 'clicker' },
			message: { chat: { chatId: 'thread' }, parent_topic: { chatId: 'group' } },
		},
	};
	const filters = {
		chatIds: new Set(['group']),
		includeThreads: true,
		userIds: new Set(['clicker']),
	};
	assert.equal(matchesEventFilters(callback, filters), true);
	assert.equal(matchesEventFilters(callback, { ...filters, includeThreads: false }), false);
	assert.equal(matchesEventFilters(callback, { ...filters, userIds: new Set(['other']) }), false);
});
test('parent-only malformed events do not pass a chat filter', () => {
	const malformed = {
		type: 'newMessage',
		payload: { parent_topic: { chatId: 'group' }, from: { userId: 'one' } },
	};
	const filters = { chatIds: new Set(['group']), includeThreads: true };
	assert.equal(matchesEventFilters(malformed, filters), false);
});
