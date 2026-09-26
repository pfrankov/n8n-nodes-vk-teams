export type HttpMethod = 'GET' | 'POST';

export type BinaryFile = {
	data: Buffer | NodeJS.ReadableStream;
	fileName: string;
	mimeType: string;
};

export type JsonRequest = {
	requestType: 'json';
	method: HttpMethod;
	endpoint: string;
	params: Record<string, unknown>;
};

export type UploadRequest = Omit<JsonRequest, 'requestType' | 'method'> & {
	requestType: 'upload';
	method: 'POST';
	fileField: string;
	fileName: string;
	fileContentType: string;
};

export type ActionInput = Record<string, unknown> & { binaryFile?: BinaryFile };
export type ActionRequest = JsonRequest | UploadRequest;
export type JsonRequestInput = Omit<JsonRequest, 'requestType'> & {
	baseUrl: string;
	token: string;
};
