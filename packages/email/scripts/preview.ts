import { readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import type { Plugin } from 'vite';

/** Preview the same server-rendered components used for delivery. */
export function emailPreview(): Plugin {
	return {
		name: 'email-preview',
		configureServer(server) {
			const source = join(server.config.root, 'src') + sep;
			server.watcher.on('change', (file) => {
				if (file.startsWith(source)) server.ws.send({ type: 'full-reload' });
			});
			server.middlewares.use(async (request, response, next) => {
				if (request.method !== 'GET') return next();
				try {
					const templates = readdirSync(join(source, 'templates'))
						.filter((file) => /^[a-zA-Z0-9_-]+\.svelte$/.test(file))
						.map((file) => file.slice(0, -7));
					const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
					let html: string;
					if (pathname === '/') {
						html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email templates</title>
<style>body{margin:0;font:16px sans-serif;color:#1f2937}nav{padding:16px;display:flex;gap:20px;flex-wrap:wrap;border-bottom:1px solid #ddd}a{color:#2563eb}iframe{border:0;width:100%;height:calc(100vh - 65px)}</style></head>
<body><nav aria-label="Email templates">${templates.map((name) => `<a href="/${name}" target="email">${name}</a>`).join('')}</nav><iframe name="email" title="Rendered email" src="/${templates[0]}"></iframe></body></html>`;
					} else {
						const name = pathname.slice(1);
						if (!templates.includes(name)) return next();
						const { default: component } = await server.ssrLoadModule(
							`/src/templates/${name}.svelte`
						);
						const { Renderer } = await server.ssrLoadModule('@better-svelte-email/server');
						html = await new Renderer({ disableTailwind: true }).render(component);
					}
					response.setHeader('Content-Type', 'text/html; charset=utf-8');
					response.end(await server.transformIndexHtml(pathname, html));
				} catch (error) {
					next(error);
				}
			});
		}
	};
}
