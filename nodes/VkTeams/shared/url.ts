export function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, '').replace(/\/bot\/v1$/, '');
}

export function buildApiUrl(baseUrl: string, endpoint: string): string {
	return `${normalizeBaseUrl(baseUrl)}/bot/v1${endpoint}`;
}
