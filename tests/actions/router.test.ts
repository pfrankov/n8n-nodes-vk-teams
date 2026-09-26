import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAction } from '../../nodes/VkTeams/actions/router';

test('resolveAction returns message.sendText handler', () => {
	const action = resolveAction('message.sendText');

	assert.equal(action.key, 'message.sendText');
});

test('resolveAction throws for unknown action', () => {
	assert.throws(() => resolveAction('message.missing'));
});

test('all displayed operations resolve through the executor registry and have an API contract', async () => {
	const { VkTeams } = await import('../../nodes/VkTeams/VkTeams.node');
	const { readFileSync } = await import('node:fs');
	const { parse } = await import('yaml');
	const schema = parse(readFileSync('docs/vk-teams-bot-api.openapi.yaml', 'utf8'));
	const documented = new Set(
		Object.values(schema.paths).flatMap((methods) =>
			Object.values(methods as Record<string, { 'x-n8n-operation': string }>).map(
				(method) => method['x-n8n-operation'],
			),
		),
	);
	documented.delete('vkTeamsTrigger.longPoll');
	documented.add('file.download');
	const visible: string[] = [];
	for (const property of new VkTeams().description.properties) {
		if (property.name !== 'operation') continue;
		const resource = property.displayOptions?.show?.resource?.[0];
		for (const option of property.options as Array<{ value: string }>) {
			const key = `${resource}.${option.value}`;
			assert.equal(resolveAction(key).key, key);
			visible.push(key);
		}
	}
	assert.equal(visible.length, 30);
	assert.deepEqual(visible.sort(), [...documented].sort());
});
