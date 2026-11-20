import { createRequestHandler } from 'react-router';
import { createFrontendWorker } from '@ak5/webui/server';

const handle = createRequestHandler(
	() => import('virtual:react-router/server-build'),
	import.meta.env.MODE
);

export default createFrontendWorker(handle);
