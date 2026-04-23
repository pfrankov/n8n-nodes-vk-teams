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

const LONG_POLL_TIMEOUT_SECONDS = 60;

const triggerProperties: INodeProperties[] = [
	{
		displayName: 'Trigger On',
		name: 'events',
		type: 'multiOptions',
		options: [
			{ name: 'Message', value: 'message' },
			{ name: 'Edited Message', value: 'editedMessage' },
			{ name: 'Deleted Message', value: 'deletedMessage' },
			{ name: 'Callback Query', value: 'callbackQuery' },
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
		displayName: 'Restrict To User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Download Files',
		name: 'downloadFiles',
		type: 'boolean',
		default: false,
	},
];

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
						pollTime: LONG_POLL_TIMEOUT_SECONDS,
						allowedTypes: new Set(this.getNodeParameter('events') as string[]),
						chatIds: parseIdSet(this.getNodeParameter('chatIds', '') as string),
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
