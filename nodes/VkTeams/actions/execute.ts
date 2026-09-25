import type { ActionInput, BinaryFile, JsonRequest, UploadRequest } from '../shared/types';
import { stringValue } from '../shared/validation';
import { resolveAction } from './router';

type ActionDependencies = {
	requestJson(request: JsonRequest): Promise<unknown>;
	requestUpload(request: UploadRequest, binaryFile: BinaryFile): Promise<unknown>;
	downloadBinary(url: string): Promise<Buffer>;
};

export async function executeAction(
	deps: ActionDependencies,
	actionKey: string,
	input: ActionInput,
): Promise<{ json: unknown; binaryFile?: BinaryFile & { data: Buffer } }> {
	const request = resolveAction(actionKey).buildRequest(input);
	if (request.requestType === 'upload') {
		// Upload builders require binaryFile before a request can reach this point.
		return { json: await deps.requestUpload(request, input.binaryFile!) };
	}
	const json = await deps.requestJson(request);
	if (actionKey !== 'file.download') return { json };
	const info = json as { url?: string; filename?: string };
	const fileName = stringValue(info?.filename, 'filename');
	const url = stringValue(info?.url, 'url');
	return {
		json,
		binaryFile: {
			data: await deps.downloadBinary(url),
			fileName,
			mimeType: 'application/octet-stream',
		},
	};
}
