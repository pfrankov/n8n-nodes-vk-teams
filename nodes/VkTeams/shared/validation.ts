export function stringValue(value: unknown, field: string, allowEmpty = false): string {
	if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
		throw new Error(
			allowEmpty
				? `${field} must be a string`
				: `${field} is required and must be a nonempty string`,
		);
	}
	return value;
}

export function stringIds(value: unknown, field: string): string[] {
	let parsed = value;
	if (typeof parsed === 'string') {
		try {
			parsed = JSON.parse(parsed);
		} catch {
			throw new Error(`${field} must be a JSON array of string IDs`);
		}
	}
	if (!Array.isArray(parsed) || parsed.length === 0)
		throw new Error(`${field} must be a nonempty array with at least one string ID`);
	const ids = Array.from(parsed, (id) => stringValue(id, field));
	if (new Set(ids).size !== ids.length) throw new Error(`${field} must not contain duplicate IDs`);
	return ids;
}

export function booleanParam(value: unknown, field: string): string {
	if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean`);
	return String(value);
}

export function httpUrl(value: unknown, field: string): string {
	const text = stringValue(value, field);
	let url: URL;
	try {
		url = new URL(text);
	} catch {
		throw new Error(`${field} must be an absolute HTTP(S) URL`);
	}
	if (
		!['http:', 'https:'].includes(url.protocol) ||
		url.username ||
		url.password ||
		/\s/.test(text)
	) {
		throw new Error(`${field} must be an absolute HTTP(S) URL without credentials or whitespace`);
	}
	return text;
}
