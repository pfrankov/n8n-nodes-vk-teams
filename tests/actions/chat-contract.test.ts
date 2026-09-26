import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { NodeHelpers } from 'n8n-workflow';
import type { INodeParameters } from 'n8n-workflow';
import { VkTeams } from '../../nodes/VkTeams/VkTeams.node';
import { VkTeamsTrigger } from '../../nodes/VkTeamsTrigger/VkTeamsTrigger.node';
import { chatMethods } from '../../nodes/VkTeams/actions/chat.requests';

const schema = parse(readFileSync('docs/vk-teams-bot-api.openapi.yaml', 'utf8'));
const workflow = JSON.parse(
	readFileSync('docs/workflows/vk-teams-chat-verification.workflow.json', 'utf8'),
);

test('schema covers every implemented chat method and marks private availability', () => {
	const documented = Object.entries(schema.paths)
		.filter(([path]) => path.startsWith('/chats/'))
		.map(
			([, methods]) =>
				Object.values(methods as Record<string, { operationId: string }>)[0].operationId,
		);
	assert.deepEqual(documented.sort(), [...Object.keys(chatMethods), 'chat.setAvatar'].sort());
	for (const path of ['/chats/createChat', '/chats/members/add'])
		assert.match(schema.paths[path].get['x-api-availability'], /myteam_only\/privateMethod/);
	assert.equal(schema.paths['/chats/createChat'].get.parameters.some((p: { $ref: string }) => p.$ref.endsWith('/chatId')), false);
	assert.equal(schema.components.parameters.initialMembers.required, false);
	assert.deepEqual(
		schema.components.parameters.members.content['application/json'].schema.items.required,
		['sn'],
	);
	assert.equal(schema.components.parameters.members.content['application/json'].schema.minItems, 1);
	assert.equal(schema.components.parameters.actions.explode, true);
	assert.equal(schema.components.schemas.ChatMember.properties.admin.type, 'boolean');
	assert.equal(schema.components.parameters.everyone.schema.const, true);
	assert.deepEqual(schema.components.schemas.ChatAvatarUpload.required, ['image']);
	assert.deepEqual(schema.components.schemas.ChatMembersResponse.properties.cursor.type, [
		'string',
		'null',
	]);
	for (const name of ['ChatMembersResponse', 'ChatAdminsResponse', 'ChatUsersResponse']) {
		assert.equal(schema.components.schemas[name].additionalProperties, true);
	}
});

test('schema event union matches the Trigger choices and keeps the message alias', () => {
	const property = new VkTeamsTrigger().description.properties.find((p) => p.name === 'events')!;
	const types = (property.options as Array<{ value: string }>).map((o) =>
		o.value === 'message' ? 'newMessage' : o.value,
	);
	assert.deepEqual(
		Object.keys(schema.components.schemas.SupportedEvent.discriminator.mapping).sort(),
		types.sort(),
	);
	assert.equal(schema.components.schemas.SupportedEvent.oneOf.length, 8);
	assert.equal(
		schema.components.schemas.UnpinnedMessageEvent.allOf[1].properties.payload.properties.from,
		undefined,
	);
});

test('chat example has a read-only default graph, disabled changes, and no credentials', () => {
	assert.equal(workflow.active, false);
	const node = new VkTeams();
	const readNames: string[] = [];
	const exampleOperations: string[] = [];
	for (const item of workflow.nodes) {
		assert.equal(item.credentials, undefined);
		if (item.type === 'n8n-nodes-vk-teams.vkTeams') {
			const parameters = item.parameters as INodeParameters;
			exampleOperations.push(String(parameters.operation));
			const normalized = NodeHelpers.getNodeParameters(
				node.description.properties,
				parameters,
				true,
				false,
				null,
				node.description,
			);
			assert.ok(normalized);
			for (const [field, value] of Object.entries(parameters))
				assert.deepEqual(normalized[field], value, `${item.name}.${field}`);
			if (String(parameters.operation).startsWith('get')) readNames.push(item.name);
			else {
				assert.equal(item.disabled, true, item.name);
				assert.equal(workflow.connections[item.name], undefined);
			}
		}
		if (item.type === 'n8n-nodes-vk-teams.vkTeamsTrigger') {
			assert.equal(item.disabled, true);
			assert.equal(item.parameters.downloadFiles, false);
			assert.equal(item.parameters.events.length, 8);
		}
	}
	assert.equal(exampleOperations.length, 17);
	assert.ok(exampleOperations.includes('createChat'));
	assert.ok(exampleOperations.includes('addMembers'));
	assert.deepEqual(
		workflow.connections['Read Test Chat'].main[0]
			.map((edge: { node: string }) => edge.node)
			.sort(),
		readNames.sort(),
	);
	assert.deepEqual(workflow.connections['Observe Chat Events'].main[0], [
		{ node: 'Raw Event', type: 'main', index: 0 },
	]);
});
