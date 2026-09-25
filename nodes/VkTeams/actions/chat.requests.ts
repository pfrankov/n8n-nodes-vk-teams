import { booleanParam, stringIds, stringValue } from '../shared/validation';

type ChatInput = Record<string, unknown>;
type ChatMethod = { endpoint: string; params(input: ChatInput): Record<string, unknown> };

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
	const target =
		input.everyone === true
			? { everyone: 'true' }
			: { userId: stringValue(input.userId, 'userId') };
	return { ...target, approve: booleanParam(input.approve, 'approve') };
}

export const chatMethods: Record<string, ChatMethod> = {
	'chat.getInfo': { endpoint: '/chats/getInfo', params: () => ({}) },
	'chat.getMembers': {
		endpoint: '/chats/getMembers',
		params: (input) =>
			input.cursor === undefined || input.cursor === ''
				? {}
				: { cursor: stringValue(input.cursor, 'cursor') },
	},
	'chat.getAdmins': { endpoint: '/chats/getAdmins', params: () => ({}) },
	'chat.getBlockedUsers': { endpoint: '/chats/getBlockedUsers', params: () => ({}) },
	'chat.getPendingUsers': { endpoint: '/chats/getPendingUsers', params: () => ({}) },
	'chat.deleteMembers': {
		endpoint: '/chats/members/delete',
		params: (input) => ({
			members: JSON.stringify(stringIds(input.members, 'members').map((sn) => ({ sn }))),
		}),
	},
	'chat.setTitle': {
		endpoint: '/chats/setTitle',
		params: (input) => ({ title: stringValue(input.title, 'title') }),
	},
	'chat.setAbout': {
		endpoint: '/chats/setAbout',
		params: (input) => ({ about: stringValue(input.about, 'about', true) }),
	},
	'chat.setRules': {
		endpoint: '/chats/setRules',
		params: (input) => ({ rules: stringValue(input.rules, 'rules', true) }),
	},
	'chat.sendActions': {
		endpoint: '/chats/sendActions',
		params: (input) => ({ actions: actions(input) }),
	},
	'chat.blockUser': {
		endpoint: '/chats/blockUser',
		params: (input) => ({
			userId: stringValue(input.userId, 'userId'),
			delLastMessages: booleanParam(
				input.delLastMessages === undefined ? false : input.delLastMessages,
				'delLastMessages',
			),
		}),
	},
	'chat.unblockUser': {
		endpoint: '/chats/unblockUser',
		params: (input) => ({ userId: stringValue(input.userId, 'userId') }),
	},
	'chat.resolvePending': { endpoint: '/chats/resolvePending', params: pendingTarget },
	'chat.pinMessage': {
		endpoint: '/chats/pinMessage',
		params: (input) => ({ msgId: stringValue(input.msgId, 'msgId') }),
	},
	'chat.unpinMessage': {
		endpoint: '/chats/unpinMessage',
		params: (input) => ({ msgId: stringValue(input.msgId, 'msgId') }),
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
		params: { chatId: stringValue(input.chatId, 'chatId'), ...method.params(input) },
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
		params: { chatId: stringValue(input.chatId, 'chatId') },
		fileField: 'image',
		fileName: input.fileName,
		fileContentType: input.fileContentType,
	};
}
