import { useRouteLoaderData } from 'react-router';
import type { loader as rootLoader } from '../root';
import IconSocial from '@ak5/webui/components/IconSocial';

export default function OAuthLogin() {
	const apiUrl = useRouteLoaderData<typeof rootLoader>('root')?.apiUrl;
	if (!apiUrl) return null;
	return (
		<>
			<div className="my-4 flex justify-center border-b border-line pb-2 text-xs text-ink/50">
				or
			</div>
			<a
				href={new URL('/oauth/discord', apiUrl).href}
				className="ui-button w-full gap-2"
				rel="external"
			>
				<IconSocial platform="discord" size="lg" />
				Continue with Discord
			</a>
		</>
	);
}
