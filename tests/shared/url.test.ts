import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApiUrl, normalizeBaseUrl } from '../../nodes/VkTeams/shared/url';

test('normalizeBaseUrl strips trailing slash', () => {
	assert.equal(normalizeBaseUrl('https://myteam.example/'), 'https://myteam.example');
});

test('normalizeBaseUrl keeps clean base url unchanged', () => {
	assert.equal(normalizeBaseUrl('https://myteam.example'), 'https://myteam.example');
});

test('normalizeBaseUrl strips existing bot api suffix', () => {
	assert.equal(normalizeBaseUrl('https://myteam.example/bot/v1'), 'https://myteam.example');
});

test('normalizeBaseUrl strips existing bot api suffix with trailing slash', () => {
	assert.equal(normalizeBaseUrl('https://myteam.example/bot/v1/'), 'https://myteam.example');
});

test('buildApiUrl appends endpoint to bot api root', () => {
	assert.equal(
		buildApiUrl('https://myteam.example', '/messages/sendText'),
		'https://myteam.example/bot/v1/messages/sendText',
	);
});

test('buildApiUrl does not duplicate bot api path', () => {
	assert.equal(
		buildApiUrl('https://myteam.example/bot/v1', '/self/get'),
		'https://myteam.example/bot/v1/self/get',
	);
});
