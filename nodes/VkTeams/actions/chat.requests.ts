type ChatInput = Record<string, unknown>;
type ChatMethod = { endpoint: string; params(input: ChatInput): Record<string, unknown> };

function text(input: ChatInput, field: string, allowEmpty = false): string {
	const value = input[field];
	if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
		throw new Error(`${field} must be ${allowEmpty ? 'a string' : 'a nonempty string'}`);
	}
	return value;
}

function booleanString(value: unknown, field: string): string {
	if (typeof value !== 'boolean') {
		throw new Error(`${field} must be a boolean`);
	}
	return String(value);
}

function members(input: ChatInput): string {
	let value = input.members;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			throw new Error('members must be a JSON array of user ID strings');
		}
	}
	if (!Array.isArray(value) || value.length === 0) {
		throw new Error('members must contain at least one user ID');
	}
	const ids = Array.from(value, (id) => text({ id }, 'id'));
	if (new Set(ids).size !== ids.length) {
		throw new Error('members must not contain duplicate user IDs');
	}
	return JSON.stringify(ids.map((sn) => ({ sn })));
}

function actions(input: ChatInput): string | string[] {
	const value = input.actions;
	if (
		!Array.isArray(value) ||
		Array.from(value).some((action) => action !== 'typing' && action !== 'looking')
	) {
		throw new Error('actions must be an array containing only typing and looking');
	}
	// OpenAPI form/explode and the official Python/Go SDKs use repeated query keys.
	return value.length === 0 ? '' : [...new Set<string>(value)];
}

function pendingTarget(input: ChatInput): Record<string, unknown> {
	if (input.everyone !== undefined && typeof input.everyone !== 'boolean') {
		throw new Error('everyone must be a boolean');
	}
	const hasUser = input.userId !== undefined && input.userId !== '';
	if (hasUser === (input.everyone === true)) {
		throw new Error('Select exactly one target: userId or everyone=true');
	}
	const target = input.everyone === true ? { everyone: 'true' } : { userId: text(input, 'userId') };
	return { ...target, approve: booleanString(input.approve, 'approve') };
}

export const chatMethods: Record<string, ChatMethod> = {
	'chat.getInfo': { endpoint: '/chats/getInfo', params: () => ({}) },
	'chat.getMembers': {
		endpoint: '/chats/getMembers',
		params: (input) =>
			input.cursor === undefined || input.cursor === '' ? {} : { cursor: text(input, 'cursor') },
	},
	'chat.getAdmins': { endpoint: '/chats/getAdmins', params: () => ({}) },
	'chat.getBlockedUsers': { endpoint: '/chats/getBlockedUsers', params: () => ({}) },
	'chat.getPendingUsers': { endpoint: '/chats/getPendingUsers', params: () => ({}) },
	'chat.deleteMembers': {
		endpoint: '/chats/members/delete',
		params: (input) => ({ members: members(input) }),
	},
	'chat.setTitle': {
		endpoint: '/chats/setTitle',
		params: (input) => ({ title: text(input, 'title') }),
	},
	'chat.setAbout': {
		endpoint: '/chats/setAbout',
		params: (input) => ({ about: text(input, 'about', true) }),
	},
	'chat.setRules': {
		endpoint: '/chats/setRules',
		params: (input) => ({ rules: text(input, 'rules', true) }),
	},
	'chat.sendActions': {
		endpoint: '/chats/sendActions',
		params: (input) => ({ actions: actions(input) }),
	},
	'chat.blockUser': {
		endpoint: '/chats/blockUser',
		params: (input) => ({
			userId: text(input, 'userId'),
			delLastMessages: booleanString(
				input.delLastMessages === undefined ? false : input.delLastMessages,
				'delLastMessages',
			),
		}),
	},
	'chat.unblockUser': {
		endpoint: '/chats/unblockUser',
		params: (input) => ({ userId: text(input, 'userId') }),
	},
	'chat.resolvePending': { endpoint: '/chats/resolvePending', params: pendingTarget },
	'chat.pinMessage': {
		endpoint: '/chats/pinMessage',
		params: (input) => ({ msgId: text(input, 'msgId') }),
	},
	'chat.unpinMessage': {
		endpoint: '/chats/unpinMessage',
		params: (input) => ({ msgId: text(input, 'msgId') }),
	},
};

export function buildChatRequest(actionKey: string, input: ChatInput) {
	if (!Object.prototype.hasOwnProperty.call(chatMethods, actionKey)) {
		throw new Error(`Unknown action: ${actionKey}`);
	}
	const method = chatMethods[actionKey];
	return {
		requestType: 'json' as const,
		method: 'GET' as const,
		endpoint: method.endpoint,
		params: { chatId: text(input, 'chatId'), ...method.params(input) },
	};
}

export function buildSetChatAvatarRequest(input: {
	chatId: unknown;
	fileName: string;
	fileContentType: string;
}) {
	return {
		requestType: 'upload' as const,
		method: 'POST' as const,
		endpoint: '/chats/avatar/set',
		params: { chatId: text(input, 'chatId') },
		fileField: 'image',
		fileName: input.fileName,
		fileContentType: input.fileContentType,
	};
}
