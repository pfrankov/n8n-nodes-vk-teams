import { filterEvents, matchesEventFilters } from './filters';
import { pickLastEventId } from './state';

type TriggerEvent = {
	eventId?: string | number;
	type?: string;
	payload?: {
		chat?: {
			chatId?: string;
		};
		from?: {
			userId?: string;
		};
		parts?: Array<{
			type?: string;
			payload?: {
				fileId?: string;
			};
		}>;
	};
};

type TriggerBinaryFile = {
	propertyName: string;
	data: Buffer;
	fileName: string;
	mimeType: string;
};

type TriggerDependencies = {
	fetchEvents(lastEventId: number, pollTime: number): Promise<TriggerEvent[]>;
	fetchFileInfo(fileId: string): Promise<{ url: string; filename?: string }>;
	downloadBinary(url: string): Promise<Buffer>;
};

type TriggerOptions = {
	lastEventId: number;
	pollTime: number;
	allowedTypes: Set<string>;
	chatIds?: Set<string>;
	userIds?: Set<string>;
	downloadFiles: boolean;
};

function requireFileName(value: string | undefined): string {
	if (!value) {
		throw new Error('filename is required');
	}

	return value;
}

function collectFileIds(event: TriggerEvent): string[] {
	const parts = event.payload?.parts ?? [];

	return parts
		.filter((part) => part.type === 'file' || part.type === 'voice' || part.type === 'sticker')
		.map((part) => part.payload?.fileId)
		.filter((fileId): fileId is string => fileId !== undefined);
}

export async function runLongPollRequest(deps: TriggerDependencies, options: TriggerOptions) {
	const events = await deps.fetchEvents(options.lastEventId, options.pollTime);
	const filteredByType = filterEvents(events, options.allowedTypes);
	const filtered = filteredByType.filter((event) =>
		matchesEventFilters(event, {
			chatIds: options.chatIds,
			userIds: options.userIds,
		}),
	);

	const items = [];

	for (const event of filtered) {
		const item: {
			json: TriggerEvent;
			binaryFiles?: TriggerBinaryFile[];
		} = {
			json: event,
		};

		if (options.downloadFiles) {
			const fileIds = collectFileIds(event);
			const binaryFiles: TriggerBinaryFile[] = [];

			for (let index = 0; index < fileIds.length; index++) {
				const fileInfo = await deps.fetchFileInfo(fileIds[index]);
				const data = await deps.downloadBinary(fileInfo.url);

				binaryFiles.push({
					propertyName: `file_${index}`,
					data,
					fileName: requireFileName(fileInfo.filename),
					mimeType: 'application/octet-stream',
				});
			}

			if (binaryFiles.length > 0) {
				item.binaryFiles = binaryFiles;
			}
		}

		items.push(item);
	}

	return {
		items,
		lastEventId: pickLastEventId(events) ?? options.lastEventId,
	};
}
