// Dynamic rows and Bot API arrays must serialize identically to the UI collection.
// Invalid input must fail before sending; empty keyboards remain optional.
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildInlineKeyboardMarkup } from '../../nodes/VkTeams/actions/keyboard';

const rows = [
	{
		row: {
			buttons: [
				{ buttonType: 'callbackData', text: '@dev', callbackData: 'ping:dev', style: 'primary' },
				{ buttonType: 'url', text: 'Docs', url: 'https://example.com/?a=1&b=2', style: 'base' },
			],
		},
	},
];
const markup = [
	[
		{ text: '@dev', callbackData: 'ping:dev', style: 'primary' },
		{ text: 'Docs', url: 'https://example.com/?a=1&b=2', style: 'base' },
	],
];

for (const [name, value] of Object.entries({ collection: { rows }, rows, markup })) {
	test(`buildInlineKeyboardMarkup accepts dynamic ${name}`, () => {
		assert.deepEqual(buildInlineKeyboardMarkup(value), markup);
		assert.deepEqual(buildInlineKeyboardMarkup(JSON.stringify(value)), markup);
	});
}

test('buildInlineKeyboardMarkup preserves rows, unicode and callback punctuation without mutation', () => {
	const input = [
		[{ text: 'Кого пингануть?', callbackData: 'ping:dev&x=1+2/✓' }],
		[],
		[{ text: 'Ещё', callbackData: 'next' }],
	];
	const before = structuredClone(input);
	assert.deepEqual(buildInlineKeyboardMarkup(input), [
		[{ ...input[0][0], style: 'base' }],
		[{ ...input[2][0], style: 'base' }],
	]);
	assert.deepEqual(input, before);
});

test('buildInlineKeyboardMarkup preserves explicit UI button type with stale hidden fields', () => {
	assert.deepEqual(
		buildInlineKeyboardMarkup([
			[{ text: 'Docs', buttonType: 'url', url: 'https://example.com', callbackData: 'old' }],
		]),
		[[{ text: 'Docs', url: 'https://example.com', style: 'base' }]],
	);
});

for (const [name, value] of Object.entries({
	missing: undefined,
	null: null,
	blank: '',
	whitespace: '  ',
	collection: {},
	rows: { rows: [] },
	array: [],
	emptyRow: [[]],
	uiEmptyRow: { rows: [{ row: {} }] },
	jsonEmpty: '[]',
	jsonNull: 'null',
})) {
	test(`buildInlineKeyboardMarkup omits ${name}`, () => {
		assert.equal(buildInlineKeyboardMarkup(value), undefined);
	});
}

for (const [name, value, message] of [
	['invalid JSON', '{', /valid JSON/],
	['scalar', 42, /must be an object/],
	['unknown object', { wrong: [] }, /rows must be an array/],
	['non-array rows', { rows: {} }, /rows must be an array/],
	['null row', [null], /row 1 must be an object/],
	['invalid row', [{ buttons: [] }], /row 1 must contain row.buttons/],
	['invalid buttons', [{ row: { buttons: {} } }], /row 1 buttons must be an array/],
	['null button', [[null]], /button 1:1 must be an object/],
	['empty text', [[{ text: ' ', callbackData: 'ok' }]], /text is required/],
	['missing callback', [[{ text: 'OK' }]], /callback data is required/],
	['missing URL', [[{ text: 'Docs', buttonType: 'url' }]], /URL is required/],
	['invalid style', [[{ text: 'OK', callbackData: 'ok', style: 'other' }]], /style must be/],
	['invalid type', [[{ text: 'OK', callbackData: 'ok', buttonType: 'other' }]], /type must be/],
	['ambiguous action', [[{ text: 'OK', callbackData: 'ok', url: 'https://example.com' }]], /not both/],
] as const) {
	test(`buildInlineKeyboardMarkup rejects ${name}`, () => {
		assert.throws(() => buildInlineKeyboardMarkup(value), message);
	});
}
