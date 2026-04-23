import { buildApiUrl } from './url';
import type { JsonRequestInput, UploadRequestInput } from './types';

function appendQueryValue(searchParams: URLSearchParams, key: string, value: unknown): void {
	if (value === undefined) {
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			appendQueryValue(searchParams, key, item);
		}
		return;
	}

	if (typeof value === 'object' && value !== null) {
		searchParams.append(key, JSON.stringify(value));
		return;
	}

	searchParams.append(key, String(value));
}

function buildUrlWithQuery(baseUrl: string, endpoint: string, params: Record<string, unknown>): string {
	const searchParams = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		appendQueryValue(searchParams, key, value);
	}

	const queryString = searchParams.toString();
	const url = buildApiUrl(baseUrl, endpoint);

	return queryString.length > 0 ? `${url}?${queryString}` : url;
}

export function createJsonRequestOptions(input: JsonRequestInput) {
	const options = {
		method: input.method,
		url: buildUrlWithQuery(input.baseUrl, input.endpoint, {
			token: input.token,
			...input.params,
		}),
		json: true,
	} as {
		method: string;
		url: string;
		json: true;
	};

	return options;
}

export function createUploadRequestOptions(input: UploadRequestInput) {
	return {
		method: 'POST',
		url: buildUrlWithQuery(input.baseUrl, input.endpoint, {
			token: input.token,
			...input.params,
		}),
		formData: {
			[input.fileField]: {
				value: input.file,
				options: {
					filename: input.fileName,
					contentType: input.fileContentType,
				},
			},
		},
		json: true as const,
	};
}
