// Registers host behaviors (Image, Pressable, Switch, ...) that /bootstrap alone doesn't reach; deleting this breaks them silently.
import '@symbiote-native/svelte';
import { createApp } from '@symbiote-native/svelte/bootstrap';
import App from './App.svelte';
import { name as appName } from './app.json';

createApp(App).mount(appName);
