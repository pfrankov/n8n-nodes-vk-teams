// Independent endpoint/parameter expectations cross-checked against the SDKs in docs/issue-1-api-review.md.
const definitions = [
	['createChat', 'createChat', ['chatName', 'chatAbout', 'chatRules', 'initialMembers', 'chatPublic', 'defaultRole', 'joinModeration'], 'ChatCreatedResponse'],
	['addMembers', 'members/add', ['members'], 'ChatAddMembersResponse'],
	['getMembers', 'getMembers', ['cursor'], 'ChatMembersResponse'],
	['getAdmins', 'getAdmins', [], 'ChatAdminsResponse'],
	['getBlockedUsers', 'getBlockedUsers', [], 'ChatUsersResponse'],
	['getPendingUsers', 'getPendingUsers', [], 'ChatUsersResponse'],
	['deleteMembers', 'members/delete', ['members'], 'OkResponse'],
	['setTitle', 'setTitle', ['title'], 'OkResponse'],
	['setAbout', 'setAbout', ['about'], 'OkResponse'],
	['setRules', 'setRules', ['rules'], 'OkResponse'],
	['sendActions', 'sendActions', ['actions'], 'OkResponse'],
	['blockUser', 'blockUser', ['userId', 'delLastMessages'], 'OkResponse'],
	['unblockUser', 'unblockUser', ['userId'], 'OkResponse'],
	['resolvePending', 'resolvePending', ['pendingUserId', 'everyone', 'approve'], 'OkResponse'],
	['pinMessage', 'pinMessage', ['msgId'], 'OkResponse'],
	['unpinMessage', 'unpinMessage', ['msgId'], 'OkResponse'],
	['setAvatar', 'avatar/set', [], 'ChatAvatarResponse'],
];

module.exports = definitions.map(([name, path, fields, response]) => ({
	operationId: `chat.${name}`,
	n8nOperation: `chat.${name}`,
	path: `/chats/${path}`,
	method: name === 'setAvatar' ? 'post' : 'get',
	params: ['token', ...(name === 'createChat' ? [] : ['chatId']), ...fields],
	successSchemas: [response],
	requestBodySchemas: name === 'setAvatar' ? ['ChatAvatarUpload'] : [],
	sourceEndpoint: `/chats/${path}`,
	sourceMethod: name === 'setAvatar' ? 'POST' : 'GET',
	actionKey: `chat.${name}`,
	source: 'chat',
}));
