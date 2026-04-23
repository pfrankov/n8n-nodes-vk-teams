import assert from 'node:assert/strict';
import test from 'node:test';

import { filterEvents, matchesEventFilters } from '../../nodes/VkTeamsTrigger/shared/filters';

test('filterEvents keeps only selected event types', () => {
	const events = [
		{ type: 'newMessage' },
		{ type: 'callbackQuery' },
		{ type: 'deletedMessage' },
	];

	assert.deepEqual(filterEvents(events, new Set(['message', 'callbackQuery'])), [
		{ type: 'newMessage' },
		{ type: 'callbackQuery' },
	]);
});

test('filterEvents still accepts legacy message type alias', () => {
	assert.deepEqual(filterEvents([{ type: 'message' }], new Set(['message'])), [{ type: 'message' }]);
});

test('matchesEventFilters accepts event when filters are empty', () => {
	assert.equal(
		matchesEventFilters(
			{ type: 'message', payload: { chat: { chatId: 'chat-1' }, from: { userId: 'user-1' } } },
			{},
		),
		true,
	);
});

test('matchesEventFilters rejects event when chat id does not match', () => {
	assert.equal(
		matchesEventFilters(
			{ type: 'message', payload: { chat: { chatId: 'chat-2' }, from: { userId: 'user-1' } } },
			{ chatIds: new Set(['chat-1']) },
		),
		false,
	);
});

test('matchesEventFilters reads callback query chat from nested message payload', () => {
	assert.equal(
		matchesEventFilters(
			{
				type: 'callbackQuery',
				payload: {
					message: {
						chat: { chatId: 'chat-1' },
					},
					from: { userId: 'user-1' },
				},
			},
			{ chatIds: new Set(['chat-1']) },
		),
		true,
	);
});
