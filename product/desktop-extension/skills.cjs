/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const catalog = [
	{ id: 'frontend-design', title: 'Frontend Design', description: 'Purposeful UI, layout, typography and visual polish.', keywords: /\b(frontend|ui|ux|design|layout|css|landing|website|interface)\b/i },
	{ id: 'webapp-testing', title: 'Web App Testing', description: 'Playwright tests, browser checks and screenshots.', keywords: /\b(test|tests|testing|playwright|browser|screenshot|regression)\b/i },
	{ id: 'mcp-builder', title: 'MCP Builder', description: 'Build tools and integrations for external services.', keywords: /\b(mcp|integration|integrate|connector|external api|tool server)\b/i },
	{ id: 'web-artifacts-builder', title: 'Web App Builder', description: 'React, TypeScript and Vite app scaffolding and bundling.', keywords: /\b(react|vite|web app|webapp|dashboard|tailwind|shadcn|scaffold)\b/i }
];

function selectSkills(intent, selection = 'auto') {
	if (selection === 'none') { return []; }
	if (selection !== 'auto') {
		if (!catalog.some(skill => skill.id === selection)) { throw new Error('Unknown skill.'); }
		return [selection];
	}
	return catalog.filter(skill => skill.keywords.test(intent)).map(skill => skill.id).slice(0, 3);
}

/** Load vendored instructions and text resources; scripts are reference material, never auto-executed. */
async function loadSkills(extensionPath, ids) {
	const result = [];
	for (const id of ids) {
		if (!catalog.some(skill => skill.id === id)) { throw new Error('Unknown skill.'); }
		const folder = path.join(extensionPath, 'skills', id);
		const instructions = await fs.readFile(path.join(folder, 'SKILL.md'), 'utf8');
		const resources = [];
		let bytes = Buffer.byteLength(instructions);
		async function walk(directory) {
			for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
				const file = path.join(directory, entry.name);
				if (entry.isSymbolicLink()) { continue; }
				if (entry.isDirectory()) { await walk(file); }
				else if (entry.name !== 'SKILL.md' && entry.name !== 'LICENSE.txt' && /\.(md|py|sh|txt|xml)$/.test(entry.name)) {
					const stat = await fs.stat(file);
					if (bytes + stat.size > 220000) { throw new Error('Skill resources exceed the supported size.'); }
					const content = await fs.readFile(file, 'utf8');
					bytes += Buffer.byteLength(content);
					resources.push({ path: path.relative(folder, file).replaceAll('\\', '/'), content });
				}
			}
		}
		await walk(folder);
		result.push({ id, instructions, resources, source: 'https://github.com/anthropics/skills', revision: 'ca45fc496a3436251f191354091d557da31c15b5', license: 'Apache-2.0' });
	}
	return result;
}
module.exports = { catalog, selectSkills, loadSkills };
