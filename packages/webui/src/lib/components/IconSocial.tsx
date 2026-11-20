import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons/faXTwitter';
import { faFacebook } from '@fortawesome/free-brands-svg-icons/faFacebook';
import { faInstagram } from '@fortawesome/free-brands-svg-icons/faInstagram';
import { faTiktok } from '@fortawesome/free-brands-svg-icons/faTiktok';
import { faYoutube } from '@fortawesome/free-brands-svg-icons/faYoutube';
import { faDiscord } from '@fortawesome/free-brands-svg-icons/faDiscord';
import { faSnapchat } from '@fortawesome/free-brands-svg-icons/faSnapchat';
import { faTwitch } from '@fortawesome/free-brands-svg-icons/faTwitch';

const kick: IconDefinition = {
	prefix: 'fab',
	iconName: 'kickstarter-k',
	icon: [
		512,
		512,
		[],
		'',
		'M37 .036h164.448v113.621h54.71v-56.82h54.731V.036h164.448v170.777h-54.73v56.82h-54.711v56.8h54.71v56.82h54.73V512.03H310.89v-56.82h-54.73v-56.8h-54.711v113.62H37V.036z'
	]
};

const icons: Record<string, [IconDefinition, string]> = {
	twitter: [faXTwitter, '#ffffff'],
	facebook: [faFacebook, '#1877f2'],
	instagram: [faInstagram, '#c13584'],
	tiktok: [faTiktok, '#6a76ac'],
	youtube: [faYoutube, '#ff0000'],
	snapchat: [faSnapchat, '#f8cc1b'],
	discord: [faDiscord, '#7289da'],
	twitch: [faTwitch, '#9147ff'],
	kick: [kick, '#53fc18']
};
const sizes: Record<string, number> = { xs: 12, sm: 16, md: 24, lg: 32, xl: 40, '2xl': 48 };

export default function IconSocial({
	platform,
	url,
	channelId,
	disabled,
	size,
	color
}: {
	platform: string;
	url?: string;
	channelId?: string;
	disabled?: boolean;
	size?: string | number;
	color?: string;
}) {
	const name = platform === 'x' ? 'twitter' : platform;
	const entry = Object.hasOwn(icons, name) ? icons[name] : undefined;
	const href =
		url ||
		(name === 'discord' && channelId ? `https://discord.com/channels/${channelId}` : undefined);
	if (!entry)
		return <span className="inline-block h-4 w-4 rounded-full bg-base-300" aria-label={name} />;
	const [icon, brandColor] = entry;
	const pixels =
		typeof size === 'number' ? size : size ? (sizes[size] ?? (parseInt(size, 10) || 1) * 16) : 16;
	const image = (
		<FontAwesomeIcon
			icon={icon}
			color={disabled ? 'gray' : (color ?? brandColor)}
			style={{
				width: name === 'kick' ? pixels * 0.6 : pixels,
				height: name === 'kick' ? pixels * 0.6 : pixels
			}}
			className={disabled ? 'opacity-50' : undefined}
		/>
	);
	return href && !disabled ? (
		<a
			rel="external noopener"
			href={href}
			target="_blank"
			className="transition-all hover:-translate-y-1 hover:opacity-80"
			aria-label={name}
		>
			{image}
		</a>
	) : (
		image
	);
}
