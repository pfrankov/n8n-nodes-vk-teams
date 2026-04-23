export type HttpMethod = 'GET' | 'POST';

export type JsonRequestInput = {
	baseUrl: string;
	token: string;
	method: HttpMethod;
	endpoint: string;
	params: Record<string, unknown>;
};

export type UploadRequestInput = {
	baseUrl: string;
	token: string;
	endpoint: string;
	params: Record<string, unknown>;
	fileField: string;
	fileName: string;
	fileContentType: string;
	file: Buffer | NodeJS.ReadableStream;
};
