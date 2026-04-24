import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { ApplicationError, BINARY_ENCODING, NodeConnectionTypes } from 'n8n-workflow';

import { executeAction } from './actions/execute';
import { vkTeamsProperties } from './actions/descriptions';
import { downloadBinary, sendJsonRequest, sendUploadRequest } from './shared/runtime';

type BinaryFile = {
	data: Buffer | NodeJS.ReadableStream;
	fileName: string;
	mimeType: string;
};

function requireFileName(fileName: string | undefined): string {
	if (!fileName) {
		throw new ApplicationError('fileName is required for binary upload');
	}

	return fileName;
}

export async function readBinaryFile(
	context: IExecuteFunctions,
	itemIndex: number,
	binaryPropertyName: string,
): Promise<BinaryFile> {
	const binaryData = context.helpers.assertBinaryData(itemIndex, binaryPropertyName);

	if (binaryData.id) {
		return {
			data: await context.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName),
			fileName: requireFileName(binaryData.fileName),
			mimeType: binaryData.mimeType ?? 'application/octet-stream',
		};
	}

	return {
		data: Buffer.from(binaryData.data, BINARY_ENCODING),
		fileName: requireFileName(binaryData.fileName),
		mimeType: binaryData.mimeType ?? 'application/octet-stream',
	};
}

export class VkTeams implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'VK Teams',
		name: 'vkTeams',
		icon: 'file:vkTeams.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send and read data through the VK Teams Bot API',
		defaults: {
			name: 'VK Teams',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'vkTeamsApi', required: true }],
		properties: vkTeamsProperties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = (await this.getCredentials('vkTeamsApi')) as {
			accessToken: string;
			baseUrl: string;
		};
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const actionKey = `${resource}.${operation}`;
				const input: Record<string, unknown> = {};

				if (actionKey === 'message.sendText') {
					input.chatId = this.getNodeParameter('chatId', itemIndex) as string;
					input.text = this.getNodeParameter('text', itemIndex) as string;
				} else if (actionKey === 'message.editText') {
					input.chatId = this.getNodeParameter('chatId', itemIndex) as string;
					input.msgId = this.getNodeParameter('msgId', itemIndex) as string;
					input.text = this.getNodeParameter('text', itemIndex) as string;
				} else if (actionKey === 'message.deleteMessages') {
					input.chatId = this.getNodeParameter('chatId', itemIndex) as string;
					input.msgId = (
						(this.getNodeParameter('messageIds', itemIndex) as {
							values?: Array<{ msgId: string }>;
						}).values ?? []
					).map((item) => item.msgId);
				} else if (actionKey === 'message.sendFile' || actionKey === 'message.sendVoice') {
					input.chatId = this.getNodeParameter('chatId', itemIndex) as string;
					input.binaryFile = await readBinaryFile(
						this,
						itemIndex,
						this.getNodeParameter('binaryPropertyName', itemIndex) as string,
					);
				} else if (actionKey === 'callback.answerCallbackQuery') {
					input.queryId = this.getNodeParameter('queryId', itemIndex) as string;
					input.text = this.getNodeParameter('text', itemIndex, '') as string;
				} else if (actionKey === 'chat.getInfo') {
					input.chatId = this.getNodeParameter('chatId', itemIndex) as string;
				} else if (actionKey === 'file.getInfo' || actionKey === 'file.download') {
					input.fileId = this.getNodeParameter('fileId', itemIndex) as string;
				}

				const result = await executeAction(
					{
						requestJson: async (request) =>
							await sendJsonRequest(this, credentials, request),
						requestUpload: async (request, binaryFile) =>
							await sendUploadRequest(this, credentials, request, binaryFile),
						downloadBinary: async (url) => await downloadBinary(this, url),
					},
					actionKey,
					input,
				);

				const executionItem: INodeExecutionData = {
					json: result.json as IDataObject,
					pairedItem: { item: itemIndex },
				};

				if (result.binaryFile !== undefined) {
					executionItem.binary = {
						data: await this.helpers.prepareBinaryData(
							result.binaryFile.data,
							result.binaryFile.fileName,
							result.binaryFile.mimeType,
						),
					};
				}

				returnData.push(executionItem);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : 'Unknown error',
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				throw error;
			}
		}

		return [returnData];
	}
}
