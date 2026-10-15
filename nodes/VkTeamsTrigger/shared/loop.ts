import { ApplicationError, sleep } from 'n8n-workflow';

const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

type LongPollLoopDependencies<T> = {
	runOnce(): Promise<T | null>;
	emit(data: T): void;
	/**
	 * Called only for permanent failures (auth/config). Must not be used for
	 * transient HTTP/network errors: n8n's emitError() triggers runtime recovery
	 * that can register a second long-poll while this loop is still alive
	 * (see issue #5).
	 */
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

function readStatusCode(error: unknown): number | undefined {
	if (typeof error !== 'object' || error === null) {
		return undefined;
	}

	const record = error as Record<string, unknown>;

	if (typeof record.statusCode === 'number') {
		return record.statusCode;
	}

	if (typeof record.status === 'number') {
		return record.status;
	}

	const response = record.response;
	if (typeof response === 'object' && response !== null) {
		const status = (response as Record<string, unknown>).status;
		if (typeof status === 'number') {
			return status;
		}
	}

	const cause = record.cause;
	if (cause !== undefined && cause !== error) {
		return readStatusCode(cause);
	}

	return undefined;
}

/**
 * Transient long-poll failures must stay inside this loop's backoff. Escalating
 * them via emitError lets n8n recover/reconcile and spawn orphan pollers (#5).
 */
export function isTransientLongPollError(error: unknown): boolean {
	const status = readStatusCode(error);

	if (status !== undefined) {
		if (status === 408 || status === 429) {
			return true;
		}

		if (status >= 500 && status <= 599) {
			return true;
		}

		// Auth and client/config errors are permanent for this trigger instance.
		if (status >= 400 && status <= 499) {
			return false;
		}
	}

	const message = toError(error).message.toLowerCase();

	// Logical API failures often arrive as HTTP 200 + { ok: false }. sendJsonRequest()
	// turns those into a statusless ApplicationError("VK Teams API error: ..."), so we
	// must not treat them as transient network blips (issue #5 review).
	if (
		message.startsWith('vk teams api error:') ||
		message.includes('vk teams api returned an invalid response') ||
		message.includes('status code 401') ||
		message.includes('status code 403') ||
		message.includes('status code 400') ||
		message.includes('status code 404') ||
		message.includes('invalid token') ||
		message.includes('access denied') ||
		message.includes('unauthorized') ||
		message.includes('forbidden')
	) {
		return false;
	}

	// Network blips, timeouts, HTML 500 bodies without a parsed status, etc.
	return true;
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

			const normalized = toError(error);

			if (isTransientLongPollError(error)) {
				consecutiveFailures++;
				await deps.wait(getLongPollRetryDelayMs(consecutiveFailures));
				continue;
			}

			deps.emitError(normalized);
			return;
		}
	}
}
