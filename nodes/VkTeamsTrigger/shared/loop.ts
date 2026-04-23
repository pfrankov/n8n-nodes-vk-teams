import { ApplicationError, sleep } from 'n8n-workflow';

const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

type LongPollLoopDependencies<T> = {
	runOnce(): Promise<T | null>;
	emit(data: T): void;
	emitError(error: Error): void;
	isClosed(): boolean;
	wait(delayMs: number): Promise<void>;
};

function toError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	return new ApplicationError(`VK Teams trigger failed: ${String(error)}`);
}

export function getLongPollRetryDelayMs(failureCount: number): number {
	const exponent = Math.max(0, failureCount - 1);
	const delay = BASE_RETRY_DELAY_MS * 2 ** exponent;

	return Math.min(delay, MAX_RETRY_DELAY_MS);
}

export async function waitForLongPollRetry(delayMs: number): Promise<void> {
	await sleep(delayMs);
}

export async function runLongPollLoop<T>(deps: LongPollLoopDependencies<T>): Promise<void> {
	let consecutiveFailures = 0;

	while (!deps.isClosed()) {
		try {
			const executionData = await deps.runOnce();
			consecutiveFailures = 0;

			if (executionData) {
				deps.emit(executionData);
			}
		} catch (error) {
			if (deps.isClosed()) {
				return;
			}

			consecutiveFailures++;
			deps.emitError(toError(error));
			await deps.wait(getLongPollRetryDelayMs(consecutiveFailures));
		}
	}
}
