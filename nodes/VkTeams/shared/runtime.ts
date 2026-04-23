import type {
	IExecuteFunctions,
	IHttpRequestOptions,
	IPollFunctions,
	ITriggerFunctions,
} from 'n8n-workflow';
import { ApplicationError } from 'n8n-workflow';

import { createJsonRequestOptions, createUploadRequestOptions } from './transport';

type RequestContext = IExecuteFunctions | IPollFunctions | ITriggerFunctions;

type Credentials = {
	accessToken: string;
	baseUrl: string;
};

type JsonRequest = {
	method: 'GET' | 'POST';
	endpoint: string;
	params: Record<string, unknown>;
	abortSignal?: AbortSignal;
};

type UploadRequest = {
	endpoint: string;
	params: Record<string, unknown>;
	fileField: string;
	fileName: string;
	fileContentType: string;
};

type BinaryFile = {
	data: Buffer | NodeJS.ReadableStream;
	fileName: string;
	mimeType: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function getStringField(record: Record<string, unknown>, field: string): string | undefined {
	const value = record[field];

	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getVkTeamsApiErrorMessage(response: unknown): string | undefined {
	if (!isRecord(response)) {
		return undefined;
	}

	const description = getStringField(response, 'description');
	const error = getStringField(response, 'error');

	if (response.ok === false) {
		return description ?? error ?? 'Request failed';
	}

	if (response.ok !== true && description !== undefined) {
		return description;
	}

	return undefined;
}

export function assertSuccessfulVkTeamsResponse<T>(response: T): T {
	const errorMessage = getVkTeamsApiErrorMessage(response);

	if (errorMessage !== undefined) {
		throw new ApplicationError(`VK Teams API error: ${errorMessage}`);
	}

	return response;
}

export async function sendJsonRequest(
	context: RequestContext,
	credentials: Credentials,
	request: JsonRequest,
) {
	const options = createJsonRequestOptions({
		baseUrl: credentials.baseUrl,
		token: credentials.accessToken,
		method: request.method,
		endpoint: request.endpoint,
		params: request.params,
	});

	if (request.abortSignal) {
		(options as IHttpRequestOptions).abortSignal = request.abortSignal;
	}

	const response = await context.helpers.httpRequest(options as IHttpRequestOptions);

	return assertSuccessfulVkTeamsResponse(response);
}

export async function sendUploadRequest(
	context: RequestContext,
	credentials: Credentials,
	request: UploadRequest,
	binaryFile: BinaryFile,
) {
	const options = createUploadRequestOptions({
		baseUrl: credentials.baseUrl,
		token: credentials.accessToken,
		endpoint: request.endpoint,
		params: request.params,
		fileField: request.fileField,
		fileName: request.fileName,
		fileContentType: request.fileContentType,
		file: binaryFile.data,
	});

	const response = await context.helpers.httpRequest(options as IHttpRequestOptions);

	return assertSuccessfulVkTeamsResponse(response);
}

export async function downloadBinary(context: RequestContext, url: string) {
	const data = (await context.helpers.httpRequest({
		method: 'GET',
		url,
		json: false,
		encoding: 'arraybuffer',
	} as IHttpRequestOptions)) as Buffer;

	return Buffer.isBuffer(data) ? data : Buffer.from(data);
}
