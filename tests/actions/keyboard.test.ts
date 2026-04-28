import assert from 'node:assert/strict';
import test from 'node:test';

import { buildInlineKeyboardMarkup } from '../../nodes/VkTeams/actions/keyboard';

test('buildInlineKeyboardMarkup converts clicked rows and buttons', () => {
	assert.deepEqual(
		buildInlineKeyboardMarkup({
			rows: [
				{
					row: {
						buttons: [
							{
								text: 'Confirm',
								buttonType: 'callbackData',
								callbackData: 'confirm',
								style: 'primary',
							},
							{
								text: 'Docs',
								buttonType: 'url',
								url: 'https://teams.vk.com/botapi/',
								style: 'base',
							},
						],
					},
				},
			],
		}),
		[
			[
				{ text: 'Confirm', callbackData: 'confirm', style: 'primary' },
				{ text: 'Docs', url: 'https://teams.vk.com/botapi/', style: 'base' },
			],
		],
	);
});

test('buildInlineKeyboardMarkup omits empty keyboard collections', () => {
	assert.equal(buildInlineKeyboardMarkup({}), undefined);
	assert.equal(buildInlineKeyboardMarkup({ rows: [] }), undefined);
});

test('buildInlineKeyboardMarkup validates required button fields', () => {
	assert.throws(
		() =>
			buildInlineKeyboardMarkup({
				rows: [{ row: { buttons: [{ text: 'OK', buttonType: 'callbackData' }] } }],
			}),
		/Keyboard button 1:1 callback data is required/,
	);

	assert.throws(
		() =>
			buildInlineKeyboardMarkup({
				rows: [{ row: { buttons: [{ text: 'Docs', buttonType: 'url' }] } }],
			}),
		/Keyboard button 1:1 URL is required/,
	);
});
