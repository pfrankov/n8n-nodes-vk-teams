// Added/removed users are not the actor. Missing actors must fail a configured user filter.
import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesEventFilters } from '../../nodes/VkTeamsTrigger/shared/filters';
import { runLongPollRequest } from '../../nodes/VkTeamsTrigger/shared/longPoll';
import { VkTeamsTrigger } from '../../nodes/VkTeamsTrigger/VkTeamsTrigger.node';

const events = [
	{
		eventId: 41,
		type: 'newChatMembers',
		payload: {
			chat: { chatId: 'chat' },
			newMembers: [{ userId: 'member' }],
			addedBy: { userId: 'actor' },
		},
	},
	{
		eventId: 42,
		type: 'leftChatMembers',
		payload: {
			chat: { chatId: 'chat' },
			leftMembers: [{ userId: 'member' }],
			removedBy: { userId: 'actor' },
		},
	},
	{
		eventId: 43,
		type: 'pinnedMessage',
		payload: {
			chat: { chatId: 'chat' },
			msgId: '9007199254740993123',
			from: { userId: 'author' },
			text: 'Pinned text',
		},
	},
	{
		eventId: 44,
		type: 'unpinnedMessage',
		payload: { chat: { chatId: 'chat' }, msgId: '9007199254740993123' },
	},
];

for (const event of events) {
	test(`${event.type} retains its payload and advances the event cursor`, async () => {
		const result = await runLongPollRequest(
			{
				fetchEvents: async () => [event],
				fetchFileInfo: async () => {
					throw new Error('unexpected file request');
				},
				downloadBinary: async () => {
					throw new Error('unexpected download');
				},
			},
			{
				lastEventId: 40,
				pollTime: 60,
				allowedTypes: new Set([event.type]),
				chatIds: new Set(['chat']),
				downloadFiles: true,
			},
		);
		assert.deepEqual(result.items, [{ json: event }]);
		assert.equal(result.lastEventId, event.eventId);
		assert.equal(matchesEventFilters(event, { chatIds: new Set(['another-chat']) }), false);
	});
}

for (const event of events.slice(0, 2)) {
	test(`${event.type} filters on actor, never on affected members or unrelated from`, () => {
		assert.equal(matchesEventFilters(event, { userIds: new Set(['actor']) }), true);
		assert.equal(matchesEventFilters(event, { userIds: new Set(['member']) }), false);
		const withoutActor = {
			...event,
			payload: { chat: { chatId: 'chat' }, from: { userId: 'actor' } },
		};
		assert.equal(matchesEventFilters(withoutActor, { userIds: new Set(['actor']) }), false);
	});
}

test('pinned message uses payload.from; unpinned without user does not bypass a filter', () => {
	assert.equal(matchesEventFilters(events[2], { userIds: new Set(['author']) }), true);
	assert.equal(matchesEventFilters(events[3], { userIds: new Set(['actor']) }), false);
	assert.equal(matchesEventFilters(events[3], {}), true);
});

test('filtered chat events still advance the long-poll cursor', async () => {
	const result = await runLongPollRequest(
		{
			fetchEvents: async () => events,
			fetchFileInfo: async () => {
				throw new Error('unexpected request');
			},
			downloadBinary: async () => {
				throw new Error('unexpected request');
			},
		},
		{
			lastEventId: 40,
			pollTime: 60,
			allowedTypes: new Set(events.map((event) => event.type)),
			userIds: new Set(['nobody']),
			downloadFiles: false,
		},
	);
	assert.deepEqual(result.items, []);
	assert.equal(result.lastEventId, 44);
});

test('all eight requested event choices are present without broadening the default', () => {
	const property = new VkTeamsTrigger().description.properties.find((p) => p.name === 'events');
	assert.ok(property);
	assert.deepEqual(property.default, ['message']);
	assert.deepEqual(
		(property.options as Array<{ value: string }>).map((o) => o.value).sort(),
		[
			'message',
			'editedMessage',
			'deletedMessage',
			'callbackQuery',
			...events.map((event) => event.type),
		].sort(),
	);
});
