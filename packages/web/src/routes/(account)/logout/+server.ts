import type { RequestHandler } from './$types';
import { logoutToHome } from '#lib/logout.js';

export const POST: RequestHandler = (event) => logoutToHome(event);
export const GET: RequestHandler = (event) => logoutToHome(event);
