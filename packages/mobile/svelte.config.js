import { forbidWebOnlyConstructs } from '@symbiote-native/svelte/preprocessor';
import { scopedStyles } from '@symbiote-native/svelte/scoped-styles';
import { collapseTextWhitespace } from '@symbiote-native/svelte/collapse-text-whitespace';

export default {
	preprocess: [forbidWebOnlyConstructs(), scopedStyles(), collapseTextWhitespace()],
	// The native DOM shim creates nodes individually and styles them through Symbiote.
	compilerOptions: {
		fragments: 'tree',
		css: 'external',
		warningFilter: (warning) => warning.code !== 'element_invalid_self_closing_tag'
	}
};
