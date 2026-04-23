import type { ICredentialTestRequest, ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class VkTeamsApi implements ICredentialType {
	name = 'vkTeamsApi';

	displayName = 'VK Teams API';

	icon: Icon = 'file:../nodes/VkTeams/vkTeams.svg';

	documentationUrl = 'https://teams.vk.com/botapi/';

	properties: INodeProperties[] = [
		{
			displayName: 'Bot Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Bot token received from Metabot',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.internal.myteam.mail.ru',
			description: 'Base URL for the VK Teams server',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "").replace(/\\/bot\\/v1$/, "")}}/bot/v1',
			url: '/self/get',
			method: 'GET',
			qs: {
				token: '={{$credentials.accessToken}}',
			},
		},
	};
}
