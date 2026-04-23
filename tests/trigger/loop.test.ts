import assert from 'node:assert/strict';
import test from 'node:test';

import {
	getLongPollRetryDelayMs,
	runLongPollLoop,
} from '../../nodes/VkTeamsTrigger/shared/loop';

test('getLongPollRetryDelayMs uses capped exponential backoff', () => {
	assert.equal(getLongPollRetryDelayMs(1), 1000);
	assert.equal(getLongPollRetryDelayMs(2), 2000);
	assert.equal(getLongPollRetryDelayMs(10), 30000);
});

test('runLongPollLoop retries after a transient long-poll failure', async () => {
	let attempts = 0;
	let isClosed = false;
	const emitted: unknown[] = [];
	const errors: Error[] = [];
	const waits: number[] = [];

	await runLongPollLoop({
		async runOnce() {
			attempts++;

			if (attempts === 1) {
				throw new Error('temporary network failure');
			}

			isClosed = true;
			return ['workflow-data'];
		},
		emit(data) {
			emitted.push(data);
		},
		emitError(error) {
			errors.push(error);
		},
		isClosed() {
			return isClosed;
		},
		async wait(delayMs) {
			waits.push(delayMs);
		},
	});

	assert.equal(attempts, 2);
	assert.equal(errors.length, 1);
	assert.equal(errors[0].message, 'temporary network failure');
	assert.deepEqual(waits, [1000]);
	assert.deepEqual(emitted, [['workflow-data']]);
});
