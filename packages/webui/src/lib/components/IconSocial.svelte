<script lang="ts">
	import Fa, { type IconSize } from 'svelte-fa';
	import { faXTwitter } from '@fortawesome/free-brands-svg-icons/faXTwitter';
	import { faFacebook } from '@fortawesome/free-brands-svg-icons/faFacebook';
	import { faInstagram } from '@fortawesome/free-brands-svg-icons/faInstagram';
	import { faTiktok } from '@fortawesome/free-brands-svg-icons/faTiktok';
	import { faYoutube } from '@fortawesome/free-brands-svg-icons/faYoutube';
	import { faDiscord } from '@fortawesome/free-brands-svg-icons/faDiscord';
	import { faSnapchat } from '@fortawesome/free-brands-svg-icons/faSnapchat';
	import { faTwitch } from '@fortawesome/free-brands-svg-icons/faTwitch';

	type Props = {
		platform: string;
		url?: string;
		channelId?: string;
		disabled?: boolean;
		size?: IconSize;
		color?: string;
	};

	let {
		platform: _platform,
		url: _url,
		channelId,
		disabled = false,
		size,
		color
	}: Props = $props();

	// normalize x/twitter
	const platform = $derived(_platform === 'x' ? 'twitter' : _platform);

	// derive url - treat discord channel differently
	const url = $derived.by(() => {
		if (_url) return _url;
		if (!channelId) return undefined;
		if (platform === 'discord') {
			return `https://discord.com/channels/${channelId}`;
		}
		return undefined;
	});

	const icons = {
		x: faXTwitter,
		twitter: faXTwitter,
		facebook: faFacebook,
		instagram: faInstagram,
		tiktok: faTiktok,
		youtube: faYoutube,
		snapchat: faSnapchat,
		discord: faDiscord,
		twitch: faTwitch,
		kick: undefined // will use emoji fallback
	};
	const colors = {
		x: '#ffffff',
		twitter: '#ffffff',
		facebook: '#1877f2',
		instagram: '#c13584',
		tiktok: '#6a76ac',
		youtube: '#ff0000',
		snapchat: '#f8cc1b',
		discord: '#7289da',
		twitch: '#9147ff',
		kick: '#53fc18'
	};
	type IconPlatform = keyof typeof icons;

	function isIconPlatform(value: string): value is IconPlatform {
		return value in icons;
	}

	const icon = $derived(isIconPlatform(platform) ? icons[platform] : undefined);
	const iconColor = $derived(
		isIconPlatform(platform) ? color || colors[platform] : color || 'gray'
	);

	// Map size names to pixel values for Kick icon
	const sizeMap = {
		xs: 12,
		sm: 16,
		md: 24,
		lg: 32,
		xl: 40,
		'2xl': 48,
		'1x': 16,
		'2x': 32,
		'3x': 48,
		'4x': 64,
		'5x': 80,
		'6x': 96,
		'7x': 112,
		'8x': 128,
		'9x': 144,
		'10x': 160
	};
</script>

{#if platform === 'kick'}
	<!-- Inline SVG for Kick.com Green K logo -->
	{@const baseSize =
		typeof size === 'string'
			? sizeMap[size as keyof typeof sizeMap] || 24
			: typeof size === 'number'
				? size
				: 24}
	{@const s = baseSize * 0.6}
	<svg
		width={s}
		height={s}
		viewBox="0 0 512 512"
		xmlns="http://www.w3.org/2000/svg"
		fill-rule="evenodd"
		clip-rule="evenodd"
		stroke-linejoin="round"
		stroke-miterlimit="2"
	>
		<path
			d="M37 .036h164.448v113.621h54.71v-56.82h54.731V.036h164.448v170.777h-54.73v56.82h-54.711v56.8h54.71v56.82h54.73V512.03H310.89v-56.82h-54.73v-56.8h-54.711v113.62H37V.036z"
			fill="#53fc18"
		/>
	</svg>
{:else if url && !disabled}
	<a
		rel="external"
		href={url}
		target="_blank"
		class="transition-all hover:-translate-y-1 hover:opacity-80"
		aria-label={platform}
	>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{#if icon}
			<Fa {icon} color={iconColor} size={size as IconSize} />
		{/if}
	</a>
{:else if disabled && icon}
	<Fa {icon} color="gray" class="opacity-50" size={size as IconSize} />
{:else if icon}
	<Fa {icon} color={iconColor} size={size as IconSize} />
{:else}
	<span class="inline-block h-4 w-4 rounded-full bg-base-300" aria-label={platform}></span>
{/if}
