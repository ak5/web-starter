// See https://svelte.dev/docs/kit/types#app.d.ts
import type { GdprLocals, JwtPayload, PreferredColorScheme, ThemeClass } from '@ak5/webui';
import type { Viewer } from '#lib/types.js';

declare global {
	namespace Cloudflare {
		interface Env {
			API?: Fetcher;
		}
	}

	namespace Cloudflare {
		interface Env {
			API?: Fetcher;
		}
	}
	namespace App {
		interface Locals {
			apiFetch?: typeof fetch;
			auth: JwtPayload | null;
			jwt: string | null;
			needGdpr: GdprLocals['needGdpr'];
			gdpr: GdprLocals['gdpr'];
			prefersColorScheme: PreferredColorScheme;
			theme: ThemeClass;
		}
		interface PageData {
			auth: JwtPayload | null;
			viewer?: Viewer | null;
			needGdpr: GdprLocals['needGdpr'];
			gdpr: GdprLocals['gdpr'];
			prefersColorScheme: PreferredColorScheme;
			theme: ThemeClass;
		}
	}
}

export {};
