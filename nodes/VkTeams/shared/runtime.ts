import type {
	IExecuteFunctions,
	IHttpRequestOptions,
	IPollFunctions,
	ITriggerFunctions,
} from 'n8n-workflow';
import { ApplicationError } from 'n8n-workflow';

import { createJsonRequestOptions } from './transport';
import type { BinaryFile, JsonRequest, UploadRequest } from './types';
import { httpUrl } from './validation';

type RequestContext = IExecuteFunctions | IPollFunctions | ITriggerFunctions;

type Credentials = {
	accessToken: string;
	baseUrl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringField(record: Record<string, unknown>, field: string): string | undefined {
	const value = record[field];

	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getVkTeamsApiErrorMessage(response: Record<string, unknown>): string | undefined {
	const description = getStringField(response, 'description');
	const error = getStringField(response, 'error');

	if (response.ok === false) {
		return description ?? error ?? 'Request failed';
	}

	if (response.ok !== true) {
		return description ?? error;
	}

	return undefined;
}

export function assertSuccessfulVkTeamsResponse<T>(response: T): T {
	if (
		!isRecord(response) ||
		Object.keys(response).length === 0 ||
		(Object.prototype.hasOwnProperty.call(response, 'ok') && typeof response.ok !== 'boolean')
	) {
		throw new ApplicationError(
			'VK Teams API returned an invalid response: expected a nonempty object and a boolean ok flag when present',
		);
	}

	const errorMessage = getVkTeamsApiErrorMessage(response);

	if (errorMessage !== undefined) {
		throw new ApplicationError(`VK Teams API error: ${errorMessage}`);
	}

	return response;
}

export async function sendJsonRequest(
	context: RequestContext,
	credentials: Credentials,
	request: Omit<JsonRequest, 'requestType'> & { abortSignal?: AbortSignal },
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

	// The documented partial add-members result may have ok=false with per-user failures.
	if (
		request.endpoint === '/chats/members/add' &&
		isRecord(response) &&
		response.ok === false &&
		!Object.prototype.hasOwnProperty.call(response, 'description') &&
		!Object.prototype.hasOwnProperty.call(response, 'error') &&
		Array.isArray(response.failures) &&
		response.failures.length > 0 &&
		response.failures.every(isRecord)
	) {
		return response;
	}

	return assertSuccessfulVkTeamsResponse(response);
}

export async function sendUploadRequest(
	context: RequestContext,
	credentials: Credentials,
	request: Omit<UploadRequest, 'method' | 'requestType'>,
	binaryFile: BinaryFile,
) {
	const fileBuffer = Buffer.isBuffer(binaryFile.data)
		? binaryFile.data
		: await streamToBuffer(binaryFile.data);
	const form = new FormData();
	form.append(
		request.fileField,
		new Blob([fileBuffer], { type: request.fileContentType }),
		request.fileName,
	);

	// Let the platform encode multipart; pass bytes through n8n's HTTP helper so
	// its proxy, TLS and SSRF policies also apply to uploads. No multipart dependency.
	const encoded = new Response(form);
	const response = await context.helpers.httpRequest({
		...createJsonRequestOptions({
			baseUrl: credentials.baseUrl,
			token: credentials.accessToken,
			method: 'POST',
			endpoint: request.endpoint,
			params: request.params,
		}),
		headers: { 'Content-Type': encoded.headers.get('content-type')! },
		body: Buffer.from(await encoded.arrayBuffer()),
	});

	return assertSuccessfulVkTeamsResponse(response);
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
	const chunks: Buffer[] = [];

	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}

	return Buffer.concat(chunks);
}

export async function downloadBinary(context: RequestContext, url: string) {
	const data = (await context.helpers.httpRequest({
		method: 'GET',
		url: httpUrl(url, 'download URL'),
		timeout: 300_000,
		json: false,
		encoding: 'arraybuffer',
	} as IHttpRequestOptions)) as Buffer;

	return Buffer.isBuffer(data) ? data : Buffer.from(data);
}
