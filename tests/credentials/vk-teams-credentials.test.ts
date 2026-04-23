import assert from 'node:assert/strict';
import test from 'node:test';

import { VkTeamsApi } from '../../credentials/VkTeamsApi.credentials';

test('VkTeamsApi credential test normalizes baseUrl before appending bot path', () => {
	const credentials = new VkTeamsApi();

	assert.equal(
		credentials.test?.request.baseURL,
		'={{$credentials.baseUrl.replace(/\\/+$/, "").replace(/\\/bot\\/v1$/, "")}}/bot/v1',
	);
});
