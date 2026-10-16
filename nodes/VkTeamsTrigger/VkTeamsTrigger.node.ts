import type {
	IDataObject,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
} from 'n8n-workflow';
import { ApplicationError, NodeConnectionTypes } from 'n8n-workflow';

import { runLongPollRequest } from './shared/longPoll';
import { runLongPollLoop, waitForLongPollRetry } from './shared/loop';
import { normalizeLastEventId } from './shared/state';
import { downloadBinary, sendJsonRequest } from '../VkTeams/shared/runtime';

/** Default under typical nginx ~60s proxy limits that return HTML 500 (issue #5). */
const DEFAULT_LONG_POLL_TIMEOUT_SECONDS = 20;
const MIN_LONG_POLL_TIMEOUT_SECONDS = 1;
const MAX_LONG_POLL_TIMEOUT_SECONDS = 55;
const INVALID_EVENTS_WARNING_INTERVAL_MS = 60_000;

const triggerProperties: INodeProperties[] = [
	{
		displayName: 'Trigger On',
		name: 'events',
		type: 'multiOptions',
		options: [
			{ name: 'Callback Query', value: 'callbackQuery' },
			{ name: 'Deleted Message', value: 'deletedMessage' },
			{ name: 'Edited Message', value: 'editedMessage' },
			{ name: 'Left Chat Members', value: 'leftChatMembers' },
			{ name: 'Message', value: 'message' },
			{ name: 'New Chat Members', value: 'newChatMembers' },
			{ name: 'Pinned Message', value: 'pinnedMessage' },
			{ name: 'Unpinned Message', value: 'unpinnedMessage' },
		],
		default: ['message'],
		required: true,
	},
	{
		displayName: 'Restrict To Chat IDs',
		name: 'chatIds',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Include Threads',
		name: 'includeThreads',
		type: 'boolean',
		default: false,
		description:
			'Whether the chat ID filter also matches parent_topic.chatId for thread events. Does not subscribe the bot or change the user filter.',
	},
	{
		displayName: 'Restrict To User IDs',
		name: 'userIds',
		description:
			'Comma-separated payload user IDs: from, addedBy, or removedBy depending on event type. Events without that user, including unpinnedMessage, do not match a nonempty filter.',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Download Files',
		name: 'downloadFiles',
		type: 'boolean',
		default: false,
	},
	{
		displayName: 'Long Poll Timeout',
		name: 'pollTime',
		type: 'number',
		default: DEFAULT_LONG_POLL_TIMEOUT_SECONDS,
		typeOptions: {
			minValue: MIN_LONG_POLL_TIMEOUT_SECONDS,
			maxValue: MAX_LONG_POLL_TIMEOUT_SECONDS,
		},
		description:
			'Seconds to wait for each /events/get long-poll. Keep below proxy idle limits; ~60 often returns HTTP 500 from nginx on some VK Teams endpoints.',
	},
];


function resolvePollTimeSeconds(value: unknown): number {
	const numeric = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(numeric)) {
		return DEFAULT_LONG_POLL_TIMEOUT_SECONDS;
	}

	return Math.min(
		MAX_LONG_POLL_TIMEOUT_SECONDS,
		Math.max(MIN_LONG_POLL_TIMEOUT_SECONDS, Math.trunc(numeric)),
	);
}

function parseIdSet(value: string): Set<string> | undefined {
	const entries = value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	if (entries.length === 0) {
		return undefined;
	}

	return new Set(entries);
}

export class VkTeamsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'VK Teams Trigger',
		name: 'vkTeamsTrigger',
		icon: 'file:vkTeamsTrigger.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Start workflows from VK Teams bot events',
		defaults: {
			name: 'VK Teams Trigger',
		},
		usableAsTool: true,
		eventTriggerDescription: '',
		triggerPanel: {
			header: '',
			executionsHelp: {
				inactive:
					"<b>While building your workflow</b>, click the 'execute step' button, then send a VK Teams message. This will trigger an execution, which will show up in this editor.<br /> <br /><b>Once you're happy with your workflow</b>, publish it. Then the node will keep a long-poll connection open and execute as soon as matching VK Teams events arrive.",
				active:
					"<b>While building your workflow</b>, click the 'execute step' button, then send a VK Teams message. This will trigger an execution, which will show up in this editor.<br /> <br /><b>Your workflow will also execute automatically</b>, since it's activated. The node keeps a long-poll connection open and emits executions as soon as matching VK Teams events arrive.",
			},
			activationHint:
				'Once activated, this node keeps a long-poll connection open to VK Teams for near-immediate message handling.',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'vkTeamsApi', required: true }],
		properties: triggerProperties,
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const credentials = (await this.getCredentials('vkTeamsApi')) as {
			accessToken: string;
			baseUrl: string;
		};
		const state = this.getWorkflowStaticData('node') as { lastEventId?: unknown };
		let isClosed = false;
		let currentAbortController: AbortController | undefined;
		let lastInvalidEventsWarningAt = -Infinity;

		const createExecutionData = async (result: Awaited<ReturnType<typeof runLongPollRequest>>) => {
			state.lastEventId = result.lastEventId;

			if (result.items.length === 0) {
				return null;
			}

			const returnData: INodeExecutionData[] = [];

			for (const item of result.items) {
				const executionItem: INodeExecutionData = {
					json: item.json as IDataObject,
				};

				if (item.binaryFiles?.length) {
					executionItem.binary = {};

					for (const binaryFile of item.binaryFiles) {
						executionItem.binary[binaryFile.propertyName] = await this.helpers.prepareBinaryData(
							binaryFile.data,
							binaryFile.fileName,
							binaryFile.mimeType,
						);
					}
				}

				returnData.push(executionItem);
			}

			return [returnData];
		};

		const runOnce = async () => {
			currentAbortController = new AbortController();

			try {
				const result = await runLongPollRequest(
					{
						fetchEvents: async (lastEventId, pollTime) => {
							const response = (await sendJsonRequest(this, credentials, {
								method: 'GET',
								endpoint: '/events/get',
								params: {
									lastEventId,
									pollTime,
								},
								abortSignal: currentAbortController?.signal,
							})) as { events?: unknown[] };

							if (!Array.isArray(response.events)) {
								const now = Date.now();
								if (
									!isClosed &&
									this.getMode() === 'trigger' &&
									now - lastInvalidEventsWarningAt >= INVALID_EVENTS_WARNING_INTERVAL_MS
								) {
									lastInvalidEventsWarningAt = now;
									this.logger.warn(
										'VK Teams /events/get response did not contain an events array; retrying with backoff. Further warnings are limited to once per minute.',
									);
								}
								throw new ApplicationError('VK Teams events response did not contain events array');
							}

							return response.events as IDataObject[];
						},
						fetchFileInfo: async (fileId) =>
							(await sendJsonRequest(this, credentials, {
								method: 'GET',
								endpoint: '/files/getInfo',
								params: {
									fileId,
								},
							})) as { url: string; filename?: string },
						downloadBinary: async (url) => await downloadBinary(this, url),
					},
					{
						lastEventId: normalizeLastEventId(state.lastEventId),
						pollTime: resolvePollTimeSeconds(this.getNodeParameter('pollTime', DEFAULT_LONG_POLL_TIMEOUT_SECONDS)),
						allowedTypes: new Set(this.getNodeParameter('events') as string[]),
						chatIds: parseIdSet(this.getNodeParameter('chatIds', '') as string),
						includeThreads: this.getNodeParameter('includeThreads', false) === true,
						userIds: parseIdSet(this.getNodeParameter('userIds', '') as string),
						downloadFiles: this.getNodeParameter('downloadFiles') as boolean,
					},
				);

				return await createExecutionData(result);
			} finally {
				currentAbortController = undefined;
			}
		};

		if (this.getMode() === 'trigger') {
			void runLongPollLoop({
				runOnce,
				emit: (executionData) => this.emit(executionData),
				emitError: (error) => this.emitError(error),
				isClosed: () => isClosed,
				wait: waitForLongPollRetry,
			});
		}

		return {
			closeFunction: async () => {
				isClosed = true;
				currentAbortController?.abort();
			},
			manualTriggerFunction: async () => {
				const executionData = await runOnce();

				if (executionData) {
					this.emit(executionData);
				}
			},
		};
	}
}
