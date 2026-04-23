import { config } from '@n8n/node-cli/eslint';

export default [
	{
		ignores: ['.test-dist/**/*', 'docs/**/*', 'tests/**/*'],
	},
	...config,
];
