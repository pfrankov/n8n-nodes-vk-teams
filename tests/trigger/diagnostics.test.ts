// Missing events must be visible without runtime recovery, log flooding, or lost cursor state.
// A later valid batch must recover; close must suppress diagnostics for late responses.
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import { VkTeamsTrigger } from '../../nodes/VkTeamsTrigger/VkTeamsTrigger.node';
import * as loop from '../../nodes/VkTeamsTrigger/shared/loop';

const warning =
	'VK Teams /events/get response did not contain an events array; retrying with backoff. Further warnings are limited to once per minute.';
const event = { eventId: 41, type: 'newMessage', payload: { text: 'private-message' } };

async function fixture(
	t: TestContext,
	responses: Array<{ at: number; body: unknown }>,
	mode = 'trigger',
	holdRetry = false,
) {
	let now = 0;
	t.mock.method(Date, 'now', () => now);
	const warnings: unknown[][] = [];
	const errors: Error[] = [];
	const emitted: unknown[] = [];
	const cursors: string[] = [];
	const waits: number[] = [];
	const state = { lastEventId: 40 };
	let active = 0;
	let maxActive = 0;
	let resolvePending!: () => void;
	const atPending = new Promise<void>((resolve) => { resolvePending = resolve; });
	let resolveRetry!: () => void;
	const atRetry = new Promise<void>((resolve) => { resolveRetry = resolve; });
	let releaseRetry!: () => void;
	const retryGate = new Promise<void>((resolve) => { releaseRetry = resolve; });
	let releaseResponse!: (body: unknown) => void;

	t.mock.method(loop, 'waitForLongPollRetry', async (delay: number) => {
		waits.push(delay);
		resolveRetry();
		if (holdRetry) await retryGate;
	});
	const response = await new VkTeamsTrigger().trigger.call({
		getMode: () => mode,
		getCredentials: async () => ({
			accessToken: 'private-token', baseUrl: 'https://private-server.example',
		}),
		getWorkflowStaticData: () => state,
		getNodeParameter: (name: string, fallback: unknown) =>
			({ events: ['message'], chatIds: '', userIds: '', downloadFiles: false } as Record<string, unknown>)[name] ?? fallback,
		logger: { warn: (...args: unknown[]) => warnings.push(args) },
		emit: (data: unknown) => emitted.push(data),
		emitError: (error: Error) => errors.push(error),
		helpers: {
			async httpRequest(options: { url: string }) {
				active++;
				maxActive = Math.max(maxActive, active);
				cursors.push(new URL(options.url).searchParams.get('lastEventId')!);
				try {
					const next = responses.shift();
					if (next) {
						now = next.at;
						return next.body;
					}
					return await new Promise((resolve) => {
						releaseResponse = resolve;
						resolvePending();
					});
				} finally {
					active--;
				}
			},
		},
	} as never);
	const close = async () => {
		await response.closeFunction?.();
		releaseRetry();
		releaseResponse?.({ ok: true });
		await new Promise((resolve) => setImmediate(resolve));
	};
	t.after(close);
	return {
		response, warnings, errors, emitted, cursors, waits, state, atPending, atRetry, close,
		maxActive: () => maxActive,
	};
}

test('missing events warns without recovery, preserves cursor, and recovers on a valid batch', { timeout: 2000 }, async (t) => {
	const f = await fixture(t, [
		{ at: 0, body: { ok: true, description: 'private-response' } },
		{ at: 1000, body: { ok: true } },
		{ at: 3000, body: { ok: true, events: [event] } },
	]);
	await f.atPending;
	assert.deepEqual(f.warnings, [[warning]]);
	assert.deepEqual(f.errors, []);
	assert.deepEqual(f.waits, [1000, 2000]);
	assert.deepEqual(f.cursors, ['40', '40', '40', '41']);
	assert.equal(f.state.lastEventId, 41);
	assert.equal(f.emitted.length, 1);
	assert.equal(f.maxActive(), 1);
});

test('missing events warnings stay limited across persistent failures and brief recovery', { timeout: 2000 }, async (t) => {
	const f = await fixture(t, [
		{ at: 0, body: { ok: true } },
		{ at: 59_999, body: { ok: true, events: null } },
		{ at: 60_000, body: { ok: true, events: 'private-response' } },
		{ at: 60_001, body: { ok: true, events: [] } },
		{ at: 60_002, body: { ok: true } },
		{ at: 119_999, body: { ok: true } },
		{ at: 120_000, body: { ok: true } },
	]);
	await f.atPending;
	assert.deepEqual(f.warnings, [[warning], [warning], [warning]]);
	assert.deepEqual(f.errors, []);
	assert.deepEqual(f.waits, [1000, 2000, 4000, 1000, 2000, 4000]);
	assert.equal(f.state.lastEventId, 40);
	assert.equal(f.emitted.length, 0);
});

test('manual missing-events errors remain visible without retry and recover on the next call', async (t) => {
	const f = await fixture(t, [
		{ at: 0, body: { ok: true } },
		{ at: 1, body: { ok: true, events: [event] } },
	], 'manual');
	await assert.rejects(f.response.manualTriggerFunction!(), /events response did not contain events array/);
	assert.equal(f.state.lastEventId, 40);
	assert.deepEqual(f.waits, []);
	assert.deepEqual(f.warnings, []);
	await f.response.manualTriggerFunction!();
	assert.equal(f.state.lastEventId, 41);
	assert.equal(f.emitted.length, 1);
});

test('close suppresses diagnostics and retries for a late missing-events response', { timeout: 2000 }, async (t) => {
	const f = await fixture(t, []);
	await f.atPending;
	await f.close();
	assert.deepEqual(f.warnings, []);
	assert.deepEqual(f.errors, []);
	assert.deepEqual(f.waits, []);
	assert.equal(f.cursors.length, 1);
	assert.equal(f.emitted.length, 0);
	assert.equal(f.state.lastEventId, 40);
});

test('close during missing-events backoff does not start another request', { timeout: 2000 }, async (t) => {
	const f = await fixture(t, [{ at: 0, body: { ok: true } }], 'trigger', true);
	await f.atRetry;
	await f.close();
	assert.deepEqual(f.warnings, [[warning]]);
	assert.deepEqual(f.errors, []);
	assert.deepEqual(f.waits, [1000]);
	assert.equal(f.cursors.length, 1);
	assert.equal(f.emitted.length, 0);
});
