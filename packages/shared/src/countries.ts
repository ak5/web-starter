import { countries, languages, type TCountryCode, type TLanguageCode } from 'countries-list';

export type { TCountryCode, TLanguageCode };

// Sorted list of countries with code and name.
export const countryList = Object.entries(countries)
	.map(([code, data]) => ({
		code: code as TCountryCode,
		name: data.name
	}))
	.sort((a, b) => a.name.localeCompare(b.name));

// Sorted list of common languages (filtered to the most widely used).
const COMMON_LANGUAGE_CODES: TLanguageCode[] = [
	'en',
	'es',
	'fr',
	'de',
	'it',
	'pt',
	'ru',
	'zh',
	'ja',
	'ko',
	'ar',
	'hi',
	'bn',
	'pa',
	'id',
	'ms',
	'th',
	'vi',
	'tr',
	'pl',
	'nl',
	'sv',
	'no',
	'da',
	'fi',
	'el',
	'he',
	'cs',
	'hu',
	'ro',
	'uk',
	'bg',
	'hr',
	'sk',
	'sl',
	'sr',
	'fa',
	'ur',
	'ta',
	'te',
	'ml',
	'mr',
	'gu',
	'kn',
	'sw',
	'tl',
	'ca',
	'eu',
	'gl'
];

export const languageList = COMMON_LANGUAGE_CODES.filter((code) => languages[code])
	.map((code) => ({
		code,
		name: languages[code].name
	}))
	.sort((a, b) => a.name.localeCompare(b.name));

export function getCountryName(code: TCountryCode): string {
	return countries[code]?.name || code;
}

export function getLanguageName(code: TLanguageCode): string {
	return languages[code]?.name || code;
}
