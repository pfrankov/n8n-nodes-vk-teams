import { ApplicationError } from 'n8n-workflow';

export const INITIAL_EVENT_ID = 0;

type EventId = string | number;

function parseEventId(value: EventId | undefined): number | undefined {
	if (typeof value === 'number') {
		return Number.isInteger(value) && value >= 0 ? value : undefined;
	}

	if (typeof value === 'string' && value.trim().length > 0) {
		const parsed = Number(value);

		return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
	}

	return undefined;
}

function requireEventId(value: EventId | undefined): number {
	const eventId = parseEventId(value);

	if (eventId === undefined) {
		throw new ApplicationError('VK Teams eventId must be a non-negative integer');
	}

	return eventId;
}

export function normalizeLastEventId(value: unknown): number {
	if (value === undefined || value === null) {
		return INITIAL_EVENT_ID;
	}

	return requireEventId(value as EventId | undefined);
}

export function pickLastEventId(events: Array<{ eventId?: EventId }>): number | undefined {
	let maxEventId: number | undefined;

	for (const event of events) {
		const eventId = requireEventId(event.eventId);

		if (maxEventId === undefined || eventId > maxEventId) {
			maxEventId = eventId;
		}
	}

	return maxEventId;
}
