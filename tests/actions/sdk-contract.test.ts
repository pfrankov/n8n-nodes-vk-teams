import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { NodeHelpers } from 'n8n-workflow';
import { VkTeams } from '../../nodes/VkTeams/VkTeams.node';
import { VkTeamsTrigger } from '../../nodes/VkTeamsTrigger/VkTeamsTrigger.node';

const schema = parse(readFileSync('docs/vk-teams-bot-api.openapi.yaml', 'utf8'));
test('SDK schema distinguishes File ID GET from binary POST without inventing endpoints', () => {
	assert.equal(Object.keys(schema.paths).length, 28);
	for (const name of ['sendFile', 'sendVoice']) {
		const operations = schema.paths[`/messages/${name}`];
		assert.equal(operations.get['x-n8n-operation'], operations.post['x-n8n-operation']);
		assert.notEqual(operations.get.operationId, operations.post.operationId);
		assert.equal(operations.get['x-n8n-file-source'], 'fileId');
		assert.equal(operations.post['x-n8n-file-source'], 'binary');
		assert.match(JSON.stringify(operations.get.responses), /MessageResponse/);
		assert.doesNotMatch(JSON.stringify(operations.get.responses), /UploadMessageResponse/);
	}
	for (const name of ['replyMsgId', 'forwardMsgId']) {
		assert.equal(schema.components.parameters[name].explode, true);
		assert.equal(schema.components.parameters[name].schema.items.type, 'string');
	}
	assert.equal(
		schema.components.parameters.format.content['application/json'].schema.$ref,
		'#/components/schemas/Format',
	);
	assert.deepEqual(Object.keys(schema.components.schemas.PreFormatRange.allOf[1].properties), [
		'code',
	]);
	assert.deepEqual(schema.components.schemas.ThreadSubscriber.required, ['sn']);
	assert.equal(schema.paths['/messages/sendTextWithDeeplink'], undefined);
	assert.equal(schema.paths['/chats/createChat'], undefined);
});
test('SDK examples keep all API nodes disabled and retain fields after n8n normalization', () => {
	const workflow = JSON.parse(
		readFileSync('docs/workflows/vk-teams-sdk-extensions.workflow.json', 'utf8'),
	);
	assert.equal(workflow.active, false);
	assert.equal(workflow.pinData, undefined);
	for (const item of workflow.nodes) {
		assert.equal(item.credentials, undefined);
		if (!item.type.startsWith('n8n-nodes-vk-teams.')) continue;
		assert.equal(item.disabled, true);
		const node = item.type.endsWith('vkTeamsTrigger') ? new VkTeamsTrigger() : new VkTeams();
		const normalized = NodeHelpers.getNodeParameters(
			node.description.properties,
			item.parameters,
			true,
			false,
			null,
			node.description,
		)!;
		for (const [key, value] of Object.entries(item.parameters))
			assert.deepEqual(normalized[key], value, `${item.name}.${key}`);
	}
	assert.equal(
		workflow.nodes.find((node: { name: string }) => node.name === 'Reply In Thread').parameters
			.chatId,
		'={{ $json.threadId }}',
	);
});
