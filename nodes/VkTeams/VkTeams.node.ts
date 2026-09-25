import { readActionInput } from './actions/sdk.input';
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

import type { BinaryFile } from './shared/types';

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

	const fileName = requireFileName(binaryData.fileName);
	return {
		data: binaryData.id
			? await context.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName)
			: Buffer.from(binaryData.data, BINARY_ENCODING),
		fileName,
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
				const read = (name: string, fallback?: unknown) =>
					this.getNodeParameter(name, itemIndex, fallback);
				const input = readActionInput(resource, operation, read);
				if (input.fileSource === 'binary' || actionKey === 'chat.setAvatar') {
					input.binaryFile = await readBinaryFile(
						this,
						itemIndex,
						read('binaryPropertyName') as string,
					);
				}

				const result = await executeAction(
					{
						requestJson: async (request) => await sendJsonRequest(this, credentials, request),
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
