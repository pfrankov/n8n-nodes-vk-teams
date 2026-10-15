import assert from 'node:assert/strict';
import test from 'node:test';

import {
	getLongPollRetryDelayMs,
	isTransientLongPollError,
	runLongPollLoop,
} from '../../nodes/VkTeamsTrigger/shared/loop';

import {
	assertSuccessfulVkTeamsResponse,
	sendJsonRequest,
} from '../../nodes/VkTeams/shared/runtime';

test('getLongPollRetryDelayMs uses capped exponential backoff', () => {
	assert.equal(getLongPollRetryDelayMs(1), 1000);
	assert.equal(getLongPollRetryDelayMs(2), 2000);
	assert.equal(getLongPollRetryDelayMs(10), 30000);
});

test('isTransientLongPollError treats 5xx and network failures as transient', () => {
	assert.equal(isTransientLongPollError(Object.assign(new Error('Request failed with status code 500'), { statusCode: 500 })), true);
	assert.equal(isTransientLongPollError(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), true);
	assert.equal(isTransientLongPollError(new Error('temporary network failure')), true);
	assert.equal(
		isTransientLongPollError({
			message: 'Request failed with status code 500',
			response: { status: 500 },
		}),
		true,
	);
});

test('isTransientLongPollError treats auth and client errors as permanent', () => {
	assert.equal(isTransientLongPollError(Object.assign(new Error('Request failed with status code 401'), { statusCode: 401 })), false);
	assert.equal(isTransientLongPollError(Object.assign(new Error('Request failed with status code 403'), { status: 403 })), false);
	assert.equal(isTransientLongPollError(Object.assign(new Error('bad request'), { statusCode: 400 })), false);
});

test('runLongPollLoop retries transient failures without emitError', async () => {
	let attempts = 0;
	let isClosed = false;
	const emitted: unknown[] = [];
	const errors: Error[] = [];
	const waits: number[] = [];

	await runLongPollLoop({
		async runOnce() {
			attempts++;

			if (attempts === 1) {
				throw Object.assign(new Error('Request failed with status code 500'), { statusCode: 500 });
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
	assert.equal(errors.length, 0, 'transient 500 must not call emitError (issue #5)');
	assert.deepEqual(waits, [1000]);
	assert.deepEqual(emitted, [['workflow-data']]);
});

test('runLongPollLoop emits permanent errors once and stops without retrying', async () => {
	let attempts = 0;
	const errors: Error[] = [];
	const waits: number[] = [];

	await runLongPollLoop({
		async runOnce() {
			attempts++;
			throw Object.assign(new Error('Request failed with status code 401'), { statusCode: 401 });
		},
		emit() {
			throw new Error('should not emit');
		},
		emitError(error) {
			errors.push(error);
		},
		isClosed() {
			return false;
		},
		async wait(delayMs) {
			waits.push(delayMs);
		},
	});

	assert.equal(attempts, 1);
	assert.equal(errors.length, 1);
	assert.equal(errors[0].message, 'Request failed with status code 401');
	assert.deepEqual(waits, []);
});

test('runLongPollLoop series of HTTP 500 keeps a single retry owner', async () => {
	let attempts = 0;
	let isClosed = false;
	const errors: Error[] = [];
	const waits: number[] = [];
	const emitted: unknown[] = [];

	await runLongPollLoop({
		async runOnce() {
			attempts++;
			if (attempts <= 3) {
				throw Object.assign(new Error('Request failed with status code 500'), {
					response: { status: 500 },
				});
			}
			isClosed = true;
			return [{ eventId: '1' }];
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

	assert.equal(attempts, 4);
	assert.equal(errors.length, 0);
	assert.deepEqual(waits, [1000, 2000, 4000]);
	assert.equal(emitted.length, 1);
});

test('isTransientLongPollError treats logical HTTP 200 auth failures as permanent', () => {
	let thrown: unknown;
	try {
		assertSuccessfulVkTeamsResponse({ ok: false, description: 'Invalid token' });
	} catch (error) {
		thrown = error;
	}

	assert.ok(thrown instanceof Error);
	assert.match((thrown as Error).message, /VK Teams API error: Invalid token/);
	assert.equal(isTransientLongPollError(thrown), false);
});

test('runLongPollLoop stops once on sendJsonRequest Invalid token without backoff', async () => {
	let attempts = 0;
	const errors: Error[] = [];
	const waits: number[] = [];

	await runLongPollLoop({
		async runOnce() {
			attempts++;
			await sendJsonRequest(
				{
					helpers: {
						async httpRequest() {
							// Real VK Teams shape: HTTP 200 with ok:false (no statusCode on the thrown error).
							return { ok: false, description: 'Invalid token' };
						},
					},
				} as never,
				{ accessToken: 'bad-token', baseUrl: 'https://myteam.example/bot/v1' },
				{
					method: 'GET',
					endpoint: '/events/get',
					params: { lastEventId: 0, pollTime: 20 },
				},
			);
			return null;
		},
		emit() {
			throw new Error('should not emit');
		},
		emitError(error) {
			errors.push(error);
		},
		isClosed() {
			return false;
		},
		async wait(delayMs) {
			waits.push(delayMs);
		},
	});

	assert.equal(attempts, 1);
	assert.equal(errors.length, 1);
	assert.match(errors[0].message, /VK Teams API error: Invalid token/);
	assert.deepEqual(waits, [], 'must not silently backoff on logical auth failure');
});

