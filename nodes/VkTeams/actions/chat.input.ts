type ReadParameter = (name: string, fallback?: unknown) => unknown;

const fields: Record<string, string[]> = {
	getInfo: [],
	getMembers: ['cursor'],
	getAdmins: [],
	getBlockedUsers: [],
	getPendingUsers: [],
	deleteMembers: ['members'],
	setTitle: ['title'],
	setAbout: ['about'],
	setRules: ['rules'],
	sendActions: ['actions'],
	blockUser: ['userId', 'delLastMessages'],
	unblockUser: ['userId'],
	pinMessage: ['msgId'],
	unpinMessage: ['msgId'],
	setAvatar: [],
};

export function readChatInput(operation: string, read: ReadParameter): Record<string, unknown> {
	const input: Record<string, unknown> = { chatId: read('chatId') };
	if (operation === 'resolvePending') {
		input.approve = read('approve', false);
		input.everyone = read('everyone', false);
		// Hidden stale user IDs must never become an additional moderation target.
		if (input.everyone !== true) input.userId = read('userId');
		return input;
	}
	if (!Object.prototype.hasOwnProperty.call(fields, operation)) {
		throw new Error(`Unknown action: chat.${operation}`);
	}
	for (const field of fields[operation]) input[field] = read(field);
	return input;
}
