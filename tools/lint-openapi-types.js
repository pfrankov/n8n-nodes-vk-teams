#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const rootDir = path.resolve(__dirname, '..');
const schemaPath = path.join(rootDir, 'docs', 'vk-teams-bot-api.openapi.yaml');
const routerPath = path.join(rootDir, 'nodes', 'VkTeams', 'actions', 'router.ts');
const requestsPath = path.join(rootDir, 'nodes', 'VkTeams', 'actions', 'requests.ts');
const triggerNodePath = path.join(rootDir, 'nodes', 'VkTeamsTrigger', 'VkTeamsTrigger.node.ts');
const triggerFiltersPath = path.join(rootDir, 'nodes', 'VkTeamsTrigger', 'shared', 'filters.ts');
const packagePath = path.join(rootDir, 'package.json');
const readmePath = path.join(rootDir, 'README.md');

const failures = [];
const liveMode = process.argv.includes('--live');

function check(condition, message) {
	if (!condition) {
		failures.push(message);
	}
}

function readText(filePath) {
	return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
	return JSON.parse(readText(filePath));
}

function loadSchema() {
	const doc = YAML.parseDocument(readText(schemaPath), {
		prettyErrors: true,
	});

	for (const error of doc.errors) {
		failures.push(`YAML parse error: ${error.message}`);
	}

	return doc.toJS();
}

function resolveLocalRef(root, ref) {
	if (typeof ref !== 'string' || !ref.startsWith('#/')) {
		failures.push(`Only local refs are allowed, got ${String(ref)}`);
		return undefined;
	}

	const parts = ref
		.slice(2)
		.split('/')
		.map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
	let current = root;

	for (const part of parts) {
		if (current === undefined || current === null || !(part in current)) {
			failures.push(`Unresolved ref: ${ref}`);
			return undefined;
		}

		current = current[part];
	}

	return current;
}

function collectRefs(value, refs = []) {
	if (Array.isArray(value)) {
		for (const item of value) {
			collectRefs(item, refs);
		}
		return refs;
	}

	if (value && typeof value === 'object') {
		if (typeof value.$ref === 'string') {
			refs.push(value.$ref);
		}

		for (const child of Object.values(value)) {
			collectRefs(child, refs);
		}
	}

	return refs;
}

function refName(ref) {
	return ref.slice(ref.lastIndexOf('/') + 1);
}

function parameterKey(parameter) {
	if (parameter.$ref) {
		return refName(parameter.$ref);
	}

	return parameter.name;
}

function operationAt(api, pathname, method) {
	return api.paths?.[pathname]?.[method];
}

function operationParameterKeys(operation) {
	return (operation.parameters ?? []).map(parameterKey);
}

function responseSuccessSchemaNames(operation) {
	const schema = operation.responses?.['200']?.content?.['application/json']?.schema;
	return collectRefs(schema)
		.map(refName)
		.filter((name) => name !== 'ApiError');
}

function hasApiErrorResponse(operation) {
	return collectRefs(operation.responses?.['200']).some((ref) => ref.endsWith('/ApiError'));
}

function requestBodySchemaNames(operation) {
	return collectRefs(operation.requestBody).map(refName);
}

function extractActionKeys(routerSource) {
	return new Set([...routerSource.matchAll(/'([^']+)'\s*:/g)].map((match) => match[1]));
}

function staticLint(api) {
	const packageJson = readJson(packagePath);
	const routerSource = readText(routerPath);
	const requestsSource = readText(requestsPath);
	const triggerNodeSource = readText(triggerNodePath);
	const triggerFiltersSource = readText(triggerFiltersPath);
	const schemaSource = readText(schemaPath);
	const readmeSource = readText(readmePath);
	const actionKeys = extractActionKeys(routerSource);

	check(api.openapi === '3.1.0', 'OpenAPI version must stay 3.1.0');
	check(api.paths && typeof api.paths === 'object', 'OpenAPI paths object is required');
	check(api.components?.schemas, 'components.schemas is required');
	check(api.components?.parameters, 'components.parameters is required');
	check(
		(packageJson.files ?? []).includes('docs/vk-teams-bot-api.openapi.yaml'),
		'package.json files must include docs/vk-teams-bot-api.openapi.yaml',
	);
	check(!schemaSource.includes('api.lesta.group'), 'Schema must not hardcode a release-specific live endpoint');
	check(!schemaSource.includes('ai_test_bot'), 'Schema must not hardcode a release-specific bot nickname');
	check(!readmeSource.includes('api.lesta.group'), 'README must not mention a release-specific live endpoint');

	for (const ref of collectRefs(api)) {
		resolveLocalRef(api, ref);
	}

	const expectedOperations = [
		{
			operationId: 'bot.getSelf',
			n8nOperation: 'bot.getSelf',
			path: '/self/get',
			method: 'get',
			params: ['token'],
			successSchemas: ['Bot'],
			sourceEndpoint: '/self/get',
			sourceMethod: 'GET',
			actionKey: 'bot.getSelf',
		},
		{
			operationId: 'message.sendText',
			n8nOperation: 'message.sendText',
			path: '/messages/sendText',
			method: 'get',
			params: ['token', 'chatId', 'text'],
			successSchemas: ['MessageResponse'],
			sourceEndpoint: '/messages/sendText',
			sourceMethod: 'GET',
			actionKey: 'message.sendText',
		},
		{
			operationId: 'message.sendFile',
			n8nOperation: 'message.sendFile',
			path: '/messages/sendFile',
			method: 'post',
			params: ['token', 'chatId'],
			successSchemas: ['UploadMessageResponse'],
			requestBodySchemas: ['UploadFileRequest'],
			sourceEndpoint: '/messages/sendFile',
			sourceMethod: 'POST',
			actionKey: 'message.sendFile',
		},
		{
			operationId: 'message.sendVoice',
			n8nOperation: 'message.sendVoice',
			path: '/messages/sendVoice',
			method: 'post',
			params: ['token', 'chatId'],
			successSchemas: ['UploadMessageResponse'],
			requestBodySchemas: ['UploadFileRequest'],
			sourceEndpoint: '/messages/sendVoice',
			sourceMethod: 'POST',
			actionKey: 'message.sendVoice',
		},
		{
			operationId: 'message.editText',
			n8nOperation: 'message.editText',
			path: '/messages/editText',
			method: 'get',
			params: ['token', 'chatId', 'msgId', 'text'],
			successSchemas: ['OkResponse'],
			sourceEndpoint: '/messages/editText',
			sourceMethod: 'GET',
			actionKey: 'message.editText',
		},
		{
			operationId: 'message.deleteMessages',
			n8nOperation: 'message.deleteMessages',
			path: '/messages/deleteMessages',
			method: 'get',
			params: ['token', 'chatId', 'msgIds'],
			successSchemas: ['OkResponse'],
			sourceEndpoint: '/messages/deleteMessages',
			sourceMethod: 'GET',
			actionKey: 'message.deleteMessages',
		},
		{
			operationId: 'callback.answerCallbackQuery',
			n8nOperation: 'callback.answerCallbackQuery',
			path: '/messages/answerCallbackQuery',
			method: 'get',
			params: ['token', 'queryId', 'callbackText'],
			successSchemas: ['OkResponse'],
			sourceEndpoint: '/messages/answerCallbackQuery',
			sourceMethod: 'GET',
			actionKey: 'callback.answerCallbackQuery',
		},
		{
			operationId: 'chat.getInfo',
			n8nOperation: 'chat.getInfo',
			path: '/chats/getInfo',
			method: 'get',
			params: ['token', 'chatId'],
			successSchemas: ['Chat'],
			sourceEndpoint: '/chats/getInfo',
			sourceMethod: 'GET',
			actionKey: 'chat.getInfo',
		},
		{
			operationId: 'file.getInfo',
			n8nOperation: 'file.getInfo',
			path: '/files/getInfo',
			method: 'get',
			params: ['token', 'fileId'],
			successSchemas: ['FileInfo'],
			sourceEndpoint: '/files/getInfo',
			sourceMethod: 'GET',
			actionKey: 'file.getInfo',
		},
		{
			operationId: 'trigger.events.get',
			n8nOperation: 'vkTeamsTrigger.longPoll',
			path: '/events/get',
			method: 'get',
			params: ['token', 'lastEventId', 'pollTime'],
			successSchemas: ['EventsResponse'],
			sourceEndpoint: '/events/get',
			sourceMethod: 'GET',
			source: 'trigger',
		},
	];

	check(Object.keys(api.paths).length === expectedOperations.length, 'Schema paths must match supported API scope exactly');

	for (const expected of expectedOperations) {
		const operation = operationAt(api, expected.path, expected.method);
		check(Boolean(operation), `${expected.method.toUpperCase()} ${expected.path} is missing`);

		if (!operation) {
			continue;
		}

		check(operation.operationId === expected.operationId, `${expected.path} operationId must be ${expected.operationId}`);
		check(
			operation['x-n8n-operation'] === expected.n8nOperation,
			`${expected.path} x-n8n-operation must be ${expected.n8nOperation}`,
		);
		check(hasApiErrorResponse(operation), `${expected.operationId} must include ApiError as a possible 200 response`);

		const params = operationParameterKeys(operation);
		check(
			params.length === expected.params.length && expected.params.every((param, index) => params[index] === param),
			`${expected.operationId} must document exactly these parameters in order: ${expected.params.join(', ')}`,
		);

		const successSchemas = responseSuccessSchemaNames(operation);
		for (const schemaName of expected.successSchemas) {
			check(successSchemas.includes(schemaName), `${expected.operationId} must return ${schemaName}`);
		}

		const bodySchemas = requestBodySchemaNames(operation);
		for (const schemaName of expected.requestBodySchemas ?? []) {
			check(bodySchemas.includes(schemaName), `${expected.operationId} must use ${schemaName} request body`);
		}

		if (expected.actionKey) {
			check(actionKeys.has(expected.actionKey), `router.ts must expose action ${expected.actionKey}`);
		}

		const source = expected.source === 'trigger' ? triggerNodeSource : requestsSource;
		const sourceLabel = expected.source === 'trigger' ? 'VkTeamsTrigger.node.ts' : 'requests.ts';

		check(source.includes(`endpoint: '${expected.sourceEndpoint}'`), `${sourceLabel} must contain endpoint ${expected.sourceEndpoint}`);
		check(
			source.includes(`method: '${expected.sourceMethod}'`),
			`${sourceLabel} must contain method ${expected.sourceMethod} for ${expected.operationId}`,
		);
	}

	check(actionKeys.has('file.download'), 'router.ts must expose virtual action file.download');
	check(
		operationAt(api, '/files/getInfo', 'get')?.['x-n8n-related-operation']?.includes('file.download'),
		'/files/getInfo must document file.download virtual flow',
	);

	const msgIds = api.components.parameters.msgIds;
	check(msgIds?.name === 'msgId', 'msgIds parameter must serialize with name=msgId');
	check(msgIds?.style === 'form' && msgIds?.explode === true, 'msgIds parameter must use repeated query serialization');
	check(
		operationAt(api, '/messages/deleteMessages', 'get')?.['x-live-observed']?.msgIdSerialization?.includes('msgId=1&msgId=2'),
		'deleteMessages must keep live-observed repeated msgId serialization note',
	);

	const answerCallback = operationAt(api, '/messages/answerCallbackQuery', 'get');
	check(
		answerCallback?.['x-live-observed']?.tokenRequired === true,
		'answerCallbackQuery must keep tokenRequired live observation',
	);

	const eventsResponse = api.components.schemas.EventsResponse;
	check(eventsResponse?.properties?.ok?.const === true, 'EventsResponse.ok must be const true');
	check(eventsResponse?.properties?.events?.type === 'array', 'EventsResponse.events must be an array');

	const supportedEvent = api.components.schemas.SupportedEvent;
	const eventMappings = supportedEvent?.discriminator?.mapping ?? {};
	for (const eventType of ['newMessage', 'editedMessage', 'deletedMessage', 'callbackQuery']) {
		check(eventMappings[eventType], `SupportedEvent discriminator must include ${eventType}`);
	}

	const newMessage = api.components.schemas.NewMessageEvent?.allOf?.[1];
	check(newMessage?.['x-raw-api-event-type'] === 'newMessage', 'NewMessageEvent must document raw API type newMessage');
	check(newMessage?.['x-n8n-trigger-event'] === 'message', 'NewMessageEvent must document n8n trigger alias message');
	check(
		triggerFiltersSource.includes("message: ['message', 'newMessage']"),
		'trigger filter must map public message event to raw newMessage event',
	);
	check(
		readText(path.join(rootDir, 'nodes', 'VkTeams', 'shared', 'transport.ts')).includes('JSON.stringify(value)'),
		'transport helper must serialize object query parameters as JSON strings',
	);
}

function normalizeBaseUrl(baseUrl) {
	return baseUrl.replace(/\/+$/, '').replace(/\/bot\/v1$/, '');
}

function buildApiUrl(baseUrl, endpoint, params) {
	const url = new URL(`${normalizeBaseUrl(baseUrl)}/bot/v1${endpoint}`);
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined) {
			continue;
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				url.searchParams.append(key, String(item));
			}
			continue;
		}
		url.searchParams.append(key, String(value));
	}
	return url;
}

async function requestJson(url) {
	const response = await fetch(url);
	const text = await response.text();
	try {
		return JSON.parse(text);
	} catch (error) {
		throw new Error(`Expected JSON from ${url.pathname}, got: ${text.slice(0, 120)}`);
	}
}

async function liveLint() {
	const token = process.env.VK_TEAMS_BOT_TOKEN;
	const baseUrl = process.env.VK_TEAMS_BASE_URL;

	if (!token || !baseUrl) {
		failures.push('Live mode requires VK_TEAMS_BASE_URL and VK_TEAMS_BOT_TOKEN');
		return;
	}

	const self = await requestJson(buildApiUrl(baseUrl, '/self/get', { token }));
	check(self.ok === true, 'Live self/get must return ok=true');
	check(typeof self.nick === 'string' && self.nick.length > 0, 'Live self/get must return nick string');
	check(typeof self.userId === 'string' && self.userId.length > 0, 'Live self/get must return userId string');

	const events = await requestJson(buildApiUrl(baseUrl, '/events/get', { token, lastEventId: 0, pollTime: 1 }));
	check(events.ok === true, 'Live events/get must return ok=true');
	check(Array.isArray(events.events), 'Live events/get must return events array');

	const invalidToken = await requestJson(buildApiUrl(baseUrl, '/self/get', { token: 'invalid-token-for-type-lint' }));
	check(invalidToken.ok === false, 'Live invalid token check must return ok=false');
	check(typeof invalidToken.description === 'string', 'Live invalid token check must return description string');

	const callbackWithoutToken = await requestJson(
		buildApiUrl(baseUrl, '/messages/answerCallbackQuery', { queryId: 'not-a-real-query-id', text: 'ok' }),
	);
	check(callbackWithoutToken.ok === false, 'Live callback without token must return ok=false');
	check(
		callbackWithoutToken.description === 'Required parameter not found',
		'Live callback without token must fail as missing required parameter',
	);

	const repeatedMsgIds = await requestJson(
		buildApiUrl(baseUrl, '/messages/deleteMessages', {
			token,
			chatId: 'not-a-real-chat-id',
			msgId: ['1', '2'],
		}),
	);
	check(repeatedMsgIds.ok === false, 'Live deleteMessages invalid chat check must return ok=false');
	check(
		repeatedMsgIds.description !== 'Required parameter not found' && repeatedMsgIds.description !== 'Bad request',
		'Live deleteMessages repeated msgId query must be accepted by parameter parsing',
	);
}

async function main() {
	const api = loadSchema();
	staticLint(api);

	if (liveMode) {
		await liveLint();
	}

	if (failures.length > 0) {
		console.error('VK Teams OpenAPI type lint failed:');
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		process.exit(1);
	}

	console.log(`VK Teams OpenAPI type lint passed${liveMode ? ' with live checks' : ''}.`);
}

main().catch((error) => {
	console.error(error.stack ?? error.message);
	process.exit(1);
});
