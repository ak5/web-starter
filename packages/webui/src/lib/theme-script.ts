export const themeScript =
	"document.documentElement.dataset.theme=document.cookie.match(/(?:^|;\\s*)theme=(system|light|dark)(?:;|$)/)?.[1]??'system';";
