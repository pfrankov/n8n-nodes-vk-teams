import assert from 'node:assert/strict';
import test from 'node:test';

import { VkTeamsTrigger } from '../../nodes/VkTeamsTrigger/VkTeamsTrigger.node';

test('VkTeamsTrigger description no longer uses polling trigger contract', () => {
	const node = new VkTeamsTrigger();

	assert.equal(node.description.polling, undefined);
	assert.equal(typeof node.trigger, 'function');
});

test('VkTeamsTrigger description no longer exposes custom pollTime field', () => {
	const node = new VkTeamsTrigger();
	const propertyNames = node.description.properties.map((property) => property.name);

	assert.equal(propertyNames.includes('pollTime'), false);
});

test('VkTeamsTrigger manual trigger performs one long-poll request with fixed timeout', async () => {
	const node = new VkTeamsTrigger();
	const emitted: unknown[] = [];
	const requests: Array<{ url: string }> = [];
	const state: { lastEventId?: string } = {};

	const triggerResult = await node.trigger.call({
		getMode() {
			return 'manual';
		},
		async getCredentials() {
			return {
				accessToken: 'token',
				baseUrl: 'https://myteam.example/bot/v1',
			};
		},
		getWorkflowStaticData() {
			return state;
		},
		getNodeParameter(name: string, defaultValue?: unknown) {
			if (name === 'events') return ['message'];
			if (name === 'chatIds') return '';
			if (name === 'userIds') return '';
			if (name === 'downloadFiles') return false;
			return defaultValue;
		},
		emit(data: unknown) {
			emitted.push(data);
		},
		emitError() {
			throw new Error('not used');
		},
		helpers: {
			async httpRequest(options: { url: string }) {
				requests.push(options);
				return {
					events: [
						{
							eventId: '41',
							type: 'message',
							payload: {
								text: 'hi',
								chat: { chatId: 'chat-1' },
								from: { userId: 'user-1' },
							},
						},
					],
				};
			},
			async prepareBinaryData() {
				throw new Error('not used');
			},
		},
	} as never);

	assert.equal(typeof triggerResult.manualTriggerFunction, 'function');
	await triggerResult.manualTriggerFunction?.();

	assert.equal(
		requests[0]?.url,
		'https://myteam.example/bot/v1/events/get?token=token&lastEventId=0&pollTime=60',
	);
	assert.equal(state.lastEventId, 41);
	assert.equal(emitted.length, 1);
});

test('VkTeamsTrigger active trigger starts continuous loop immediately', async () => {
	const node = new VkTeamsTrigger();
	const requests: Array<{ url: string }> = [];
	let resolveFirstRequest: (() => void) | undefined;

	const firstRequestDone = new Promise<void>((resolve) => {
		resolveFirstRequest = resolve;
	});

	const triggerResult = await node.trigger.call({
		getMode() {
			return 'trigger';
		},
		async getCredentials() {
			return {
				accessToken: 'token',
				baseUrl: 'https://myteam.example',
			};
		},
		getWorkflowStaticData() {
			return {};
		},
		getNodeParameter(name: string, defaultValue?: unknown) {
			if (name === 'events') return ['message'];
			if (name === 'chatIds') return '';
			if (name === 'userIds') return '';
			if (name === 'downloadFiles') return false;
			return defaultValue;
		},
		emit() {},
		emitError() {
			throw new Error('not used');
		},
		helpers: {
			async httpRequest(options: { url: string }) {
				requests.push(options);
				resolveFirstRequest?.();
				return { events: [] };
			},
			async prepareBinaryData() {
				throw new Error('not used');
			},
		},
	} as never);

	await firstRequestDone;
	await triggerResult.closeFunction?.();

	assert.equal(
		requests[0]?.url,
		'https://myteam.example/bot/v1/events/get?token=token&lastEventId=0&pollTime=60',
	);
});
