import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAction } from '../../nodes/VkTeams/actions/router';

test('resolveAction returns message.sendText handler', () => {
	const action = resolveAction('message', 'sendText');

	assert.equal(action.key, 'message.sendText');
});

test('resolveAction throws for unknown action', () => {
	assert.throws(() => resolveAction('message', 'missing'));
});
