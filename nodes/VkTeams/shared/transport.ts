import { buildApiUrl } from './url';
import type { JsonRequestInput } from './types';

function appendQueryValue(searchParams: URLSearchParams, key: string, value: unknown): void {
	if (value === undefined) {
		return;
	}

	if (key === 'inlineKeyboardMarkup') {
		searchParams.append(key, typeof value === 'string' ? value : JSON.stringify(value));
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

function buildUrlWithQuery(
	baseUrl: string,
	endpoint: string,
	token: string,
	params: Record<string, unknown>,
): string {
	const searchParams = new URLSearchParams({ token });

	for (const [key, value] of Object.entries(params)) {
		if (key !== 'token') appendQueryValue(searchParams, key, value);
	}

	const queryString = searchParams.toString();
	const url = buildApiUrl(baseUrl, endpoint);

	return queryString.length > 0 ? `${url}?${queryString}` : url;
}

export function createJsonRequestOptions(input: JsonRequestInput) {
	return {
		method: input.method,
		url: buildUrlWithQuery(input.baseUrl, input.endpoint, input.token, input.params),
		json: true as const,
		disableFollowRedirect: true,
		timeout: 300_000,
	};
}
