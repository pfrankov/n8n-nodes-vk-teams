import assert from 'node:assert/strict';
import test from 'node:test';

import {
	INITIAL_EVENT_ID,
	normalizeLastEventId,
	pickLastEventId,
} from '../../nodes/VkTeamsTrigger/shared/state';

test('pickLastEventId returns id from the last event', () => {
	assert.equal(pickLastEventId([{ eventId: 1 }, { eventId: 4 }]), 4);
});

test('pickLastEventId returns maximum id when events are out of order', () => {
	assert.equal(pickLastEventId([{ eventId: 41 }, { eventId: 43 }, { eventId: 42 }]), 43);
});

test('pickLastEventId returns undefined for empty event list', () => {
	assert.equal(pickLastEventId([]), undefined);
});

test('normalizeLastEventId defaults first poll to VK Teams initial id', () => {
	assert.equal(normalizeLastEventId(undefined), INITIAL_EVENT_ID);
});

test('normalizeLastEventId accepts persisted numeric strings', () => {
	assert.equal(normalizeLastEventId('41'), 41);
});

test('normalizeLastEventId rejects invalid persisted state', () => {
	assert.throws(() => normalizeLastEventId('not-an-id'), /eventId must be a non-negative integer/);
});

test('pickLastEventId rejects malformed events', () => {
	assert.throws(() => pickLastEventId([{}]), /eventId must be a non-negative integer/);
});
