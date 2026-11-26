import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerTools(
	server: McpServer,
	grant: { type: 'user' | 'admin'; write: boolean },
	call: (path: string, method?: string, body?: unknown) => Promise<unknown>
) {
	const result = (value: unknown) => ({
		content: [{ type: 'text' as const, text: JSON.stringify(value) }]
	});
	if (grant.type === 'user') {
		server.registerTool(
			'list_items',
			{
				description: 'List your items.',
				inputSchema: { page: z.number().int().min(0).max(10000).default(0) },
				annotations: { readOnlyHint: true }
			},
			async ({ page }) => result(await call(`/items?page=${page}`))
		);
		if (grant.write)
			server.registerTool(
				'create_item',
				{
					description: 'Create an item with a title in your account.',
					inputSchema: { title: z.string().trim().min(1).max(200) }
				},
				async ({ title }) => result(await call('/items', 'POST', { data: { title } }))
			);
		return;
	}
	server.registerTool(
		'get_system_health',
		{
			description: 'Read the starter system health status.',
			annotations: { readOnlyHint: true }
		},
		async () => {
			const health = (await call('/admin/health')) as { status: string };
			return result({ status: health.status });
		}
	);
	if (grant.write)
		server.registerTool(
			'set_my_display_name',
			{
				description: 'Update your own admin display name.',
				inputSchema: { displayName: z.string().trim().min(1).max(128) },
				annotations: { destructiveHint: false, idempotentHint: true }
			},
			async ({ displayName }) => result(await call('/me/profile', 'PATCH', { displayName }))
		);
}
