import App from './App.svelte';

const app = new App({
	target: document.getElementById("saltcorn-file-manager"),
	props: {
		name: 'world'
	}
});

export default app;