// Use n8n's parameter normalization and expression evaluator, not just resolved mocks.
// Verify the actual query string for text, edits, files and voice, including multiple items.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Expression, NodeHelpers } from 'n8n-workflow';
import type { IDataObject, INodeParameters } from 'n8n-workflow';

import { VkTeams } from '../../nodes/VkTeams/VkTeams.node';

function createExecution(
	parameters: INodeParameters,
	items: IDataObject[],
	requests: URL[],
	continueOnFail = false,
) {
	const node = new VkTeams();
	const expression = new Expression('UTC');
	const normalized = NodeHelpers.getNodeParameters(
		node.description.properties,
		parameters,
		true,
		false,
		null,
		node.description,
	);
	assert.ok(normalized);

	const context = {
		async getCredentials() {
			return { accessToken: 'test-token', baseUrl: 'https://myteam.example' };
		},
		getInputData() {
			return items.map((json) => ({ json }));
		},
		getNodeParameter(name: string, itemIndex: number, fallback?: unknown) {
			const value = normalized[name] ?? fallback;
			if (typeof value === 'string' && value.startsWith('=')) {
				return expression.resolveSimpleParameterValue(value, { $json: items[itemIndex] } as never);
			}
			return value;
		},
		continueOnFail() {
			return continueOnFail;
		},
		helpers: {
			async httpRequest(options: { url: string }) {
				requests.push(new URL(options.url));
				return { ok: true };
			},
			assertBinaryData() {
				return {
					data: Buffer.from('file').toString('base64'),
					fileName: 'sample.ogg',
					mimeType: 'audio/ogg',
				};
			},
		},
	} as never;
	return { node, context, normalized };
}

const baseParameters: INodeParameters = {
	resource: 'message',
	operation: 'sendText',
	chatId: 'chat-1',
	text: 'Кого пингануть?',
	keyboard: 'inlineKeyboardJson',
	inlineKeyboardJson: '={{ $json.rows }}',
};

function createItem(tags: string[]): IDataObject {
	const rows = tags.map((tag) => ({
		row: { buttons: [{ buttonType: 'callbackData', text: `@${tag}`, callbackData: `ping:${tag}` }] },
	}));
	return { rows };
}

test('JSON keyboard expressions survive n8n parameter normalization', () => {
	const { node, normalized } = createExecution(baseParameters, [createItem(['dev'])], []);
	assert.equal(normalized.inlineKeyboardJson, '={{ $json.rows }}');
	const field = node.description.properties.find((property) => property.name === 'inlineKeyboardJson');
	assert.equal(field?.type, 'json');
	assert.deepEqual(field?.displayOptions?.show, {
		keyboard: ['inlineKeyboardJson'],
		operation: ['sendText', 'editText', 'sendFile', 'sendVoice'],
		resource: ['message'],
	});
});

for (const operation of ['sendText', 'editText', 'sendFile', 'sendVoice']) {
	for (const expression of [
		'={{ $json.rows }}',
		'={{ { rows: $json.rows } }}',
		'={{ JSON.stringify($json.rows) }}',
		'={{ $json.rows.map(r => r.row.buttons) }}',
	]) {
		test(`${operation} serializes per-item keyboard: ${expression}`, async (t) => {
			const requests: URL[] = [];
			t.mock.method(globalThis, 'fetch', async (input: string, options: RequestInit) => {
				assert.equal(options.method, 'POST');
				assert.ok(options.body instanceof FormData);
				assert.ok(options.body.get('file') instanceof Blob);
				requests.push(new URL(input));
				return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });
			});
			const { node, context } = createExecution(
				{
					...baseParameters,
					operation,
					msgId: 'message-1',
					inlineKeyboardJson: expression,
					binaryPropertyName: 'data',
				},
				[createItem(['dev']), createItem(['qa', 'ops'])],
				requests,
			);

			const result = await node.execute.call(context);
			assert.equal(requests.length, 2);
			for (const [index, tags] of [['dev'], ['qa', 'ops']].entries()) {
				assert.equal(requests[index].pathname, `/bot/v1/messages/${operation}`);
				assert.equal(requests[index].searchParams.getAll('inlineKeyboardMarkup').length, 1);
				assert.deepEqual(
					JSON.parse(requests[index].searchParams.get('inlineKeyboardMarkup')!),
					tags.map((tag) => [{ text: `@${tag}`, callbackData: `ping:${tag}`, style: 'base' }]),
				);
			}
			assert.deepEqual(result[0].map((item) => item.pairedItem), [{ item: 0 }, { item: 1 }]);
		});
	}
}

test('malformed dynamic keyboard fails before any request', async () => {
	const requests: URL[] = [];
	const { node, context } = createExecution(baseParameters, [{ rows: [{ invalid: true }] }], requests);
	await assert.rejects(node.execute.call(context), /Keyboard row 1 must contain row.buttons/);
	assert.equal(requests.length, 0);
});

test('continueOnFail reports the invalid item and sends the next keyboard', async () => {
	const requests: URL[] = [];
	const { node, context } = createExecution(
		baseParameters,
		[{ rows: [[{ text: 'Invalid' }]] }, createItem(['dev'])],
		requests,
		true,
	);
	const result = await node.execute.call(context);
	assert.match(String(result[0][0].json.error), /callback data is required/);
	assert.deepEqual(result[0][0].pairedItem, { item: 0 });
	assert.deepEqual(result[0][1], { json: { ok: true }, pairedItem: { item: 1 } });
	assert.equal(requests.length, 1);
});

test('empty JSON keyboards and None omit the query parameter', async () => {
	for (const keyboard of ['inlineKeyboardJson', 'none']) {
		const requests: URL[] = [];
		const { node, context } = createExecution(
			{ ...baseParameters, keyboard },
			[createItem([])],
			requests,
		);
		await node.execute.call(context);
		assert.equal(requests[0].searchParams.has('inlineKeyboardMarkup'), false);
	}
});
