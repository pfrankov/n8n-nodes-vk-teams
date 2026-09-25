import { httpUrl } from './message.options';

type FormatSpan = { offset: number; length: number; url?: string; code?: string };
export type MessageFormat = Record<string, FormatSpan[]>;
const kinds = new Set([
	'bold',
	'italic',
	'underline',
	'strikethrough',
	'link',
	'mention',
	'inline_code',
	'pre',
	'ordered_list',
	'unordered_list',
	'quote',
]);

function coordinates(item: Record<string, unknown>): FormatSpan {
	const offset = item.offset;
	const length = item.length;
	if (
		!Number.isSafeInteger(offset) ||
		(offset as number) < 0 ||
		!Number.isSafeInteger(length) ||
		(length as number) < 1
	) {
		throw new Error(
			'format offset must be a nonnegative safe integer and length a positive safe integer',
		);
	}
	return { offset: offset as number, length: length as number };
}

function span(value: unknown, kind: string): FormatSpan {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('format ranges must be objects');
	const item = value as Record<string, unknown>;
	const result = coordinates(item);
	const allowed = new Set([
		'offset',
		'length',
		...(kind === 'link' ? ['url'] : []),
		...(kind === 'pre' ? ['code'] : []),
	]);
	if (Object.keys(item).some((key) => !allowed.has(key)))
		throw new Error(`Unsupported field in format.${kind} range`);
	if (kind === 'link') result.url = httpUrl(item.url, 'format link URL');
	if (kind === 'pre' && item.code !== undefined) {
		if (typeof item.code !== 'string') throw new Error('format pre code must be a string');
		result.code = item.code;
	}
	return result;
}

export function messageFormat(value: unknown): MessageFormat | undefined {
	if (value === undefined || value === '') return undefined;
	let parsed = value;
	if (typeof parsed === 'string') {
		try {
			parsed = JSON.parse(parsed);
		} catch {
			throw new Error('format must be valid JSON');
		}
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
		throw new Error('format must be a JSON object');
	const entries = Object.entries(parsed).map(([kind, ranges]) => {
		if (!kinds.has(kind)) throw new Error(`Unsupported format kind: ${kind}`);
		if (!Array.isArray(ranges)) throw new Error(`format.${kind} must be an array`);
		// Array.from validates holes as undefined rather than silently serializing null ranges.
		return [kind, Array.from(ranges, (range) => span(range, kind))] as const;
	});
	if (entries.every(([, ranges]) => ranges.length === 0)) return undefined;
	return Object.fromEntries(entries);
}
