import type { LayoutServerLoad } from './$types';
import { loadAppShell } from '#lib/app-shell.js';

export const load: LayoutServerLoad = (event) => loadAppShell(event);
