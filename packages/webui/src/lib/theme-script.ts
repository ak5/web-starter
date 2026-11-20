export const themeScript =
	"const mode=document.cookie.match(/(?:^|;\\s*)theme=(system|light|dark)(?:;|$)/)?.[1];document.documentElement.classList.toggle('dark',mode==='dark'||(mode!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches));";
