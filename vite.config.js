/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
import { defineConfig } from 'vite';

export default defineConfig({
	esbuild: { jsx: 'automatic' },
	server: {
		port: 5173,
		proxy: { '/api': 'http://127.0.0.1:4173', '/auth': 'http://127.0.0.1:4173' }
	}
});
