type EventPayload = {
	chat?: {
		chatId?: string;
	};
	message?: {
		chat?: {
			chatId?: string;
		};
	};
	from?: {
		userId?: string;
	};
};

type TriggerEvent = {
	type?: string;
	payload?: EventPayload;
};

type EventFilters = {
	chatIds?: Set<string>;
	userIds?: Set<string>;
};

const PUBLIC_TO_RAW_EVENT_TYPES: Record<string, string[]> = {
	message: ['message', 'newMessage'],
};

function expandAllowedTypes(allowedTypes: Set<string>): Set<string> {
	const expanded = new Set<string>();

	for (const type of allowedTypes) {
		expanded.add(type);

		for (const rawType of PUBLIC_TO_RAW_EVENT_TYPES[type] ?? []) {
			expanded.add(rawType);
		}
	}

	return expanded;
}

export function filterEvents<T extends { type?: string }>(events: T[], allowedTypes: Set<string>): T[] {
	if (allowedTypes.size === 0) {
		return events;
	}

	const expandedAllowedTypes = expandAllowedTypes(allowedTypes);

	return events.filter((event) => event.type !== undefined && expandedAllowedTypes.has(event.type));
}

export function matchesEventFilters(event: TriggerEvent, filters: EventFilters): boolean {
	if (filters.chatIds?.size) {
		const chatId = event.payload?.chat?.chatId ?? event.payload?.message?.chat?.chatId;

		if (chatId === undefined || !filters.chatIds.has(chatId)) {
			return false;
		}
	}

	if (filters.userIds?.size) {
		const userId = event.payload?.from?.userId;

		if (userId === undefined || !filters.userIds.has(userId)) {
			return false;
		}
	}

	return true;
}
