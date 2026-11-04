/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const toolDefinitions = [
	{ name: 'wispr_ide_context', description: 'Inspect the actual IDE: trusted workspace names, visible editor paths and selections, and installed extensions/commands. This is structured IDE state, not a screenshot.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
	{ name: 'wispr_ide_action', description: 'Operate the IDE: open common views, search/install extensions by publisher.extension ID, activate an installed extension, or run one of its declared commands. Installation and extension command execution require user approval. Use context to discover extension IDs and command IDs. Never claim success until the tool returns success.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['extensions', 'searchExtensions', 'installExtension', 'activateExtension', 'extensionCommand', 'explorer', 'search', 'sourceControl', 'settings', 'terminal', 'home'] }, extensionId: { type: 'string' }, commandId: { type: 'string' }, query: { type: 'string' } }, required: ['action'], additionalProperties: false } }
].map(tool => ({ type: 'function', ...tool }));

function createIdeTools(api, approve) {
	const views = { extensions: 'workbench.view.extensions', explorer: 'workbench.view.explorer', search: 'workbench.view.search', sourceControl: 'workbench.view.scm', settings: 'workbench.action.openSettings', terminal: 'workbench.action.terminal.toggleTerminal', home: 'wispr.home' };
	function requireTrusted() { if (!api.workspace.isTrusted || !api.workspace.workspaceFolders?.some(folder => folder.uri.scheme === 'file')) { throw new Error('Open and trust a local workspace before operating the IDE through the agent.'); } }
	return {
		definitions: toolDefinitions,
		async call(name, input) {
			requireTrusted();
			if (name === 'wispr_ide_context') {
				return {
					workspace: api.workspace.workspaceFolders.map(folder => ({ name: folder.name, path: folder.uri.fsPath })),
					activeEditor: api.window.activeTextEditor?.document.uri.fsPath || null,
					visibleEditors: api.window.visibleTextEditors.map(editor => ({ path: editor.document.uri.fsPath, language: editor.document.languageId, selection: { startLine: editor.selection.start.line + 1, endLine: editor.selection.end.line + 1 } })),
					extensions: api.extensions.all.slice(0, 500).map(extension => ({ id: extension.id, active: extension.isActive, commands: (extension.packageJSON.contributes?.commands || []).slice(0, 50).map(command => ({ id: command.command, title: command.title })) }))
				};
			}
			if (name !== 'wispr_ide_action' || !input || typeof input.action !== 'string') { throw new Error('Unknown IDE tool or invalid action'); }
			if (Object.hasOwn(views, input.action)) { await api.commands.executeCommand(views[input.action]); return { action: input.action, completed: true }; }
			if (input.action === 'searchExtensions') {
				if (typeof input.query !== 'string' || input.query.length > 200) { throw new Error('Provide a search query under 200 characters'); }
				await api.commands.executeCommand('workbench.extensions.search', input.query); return { completed: true, note: 'Extension search opened. Choose a real publisher.extension ID before installing.' };
			}
			if (typeof input.extensionId !== 'string' || !/^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9._-]*$/i.test(input.extensionId)) { throw new Error('Provide a publisher.extension ID, not a URL or VSIX path'); }
			if (input.action === 'installExtension') {
				if (!await approve('Install extension (third-party code)', { extensionId: input.extensionId })) { throw new Error('Extension installation declined'); }
				requireTrusted();
				await api.commands.executeCommand('workbench.extensions.installExtension', input.extensionId, { enable: true });
				return { completed: true, installed: input.extensionId, note: 'Installation completed. A window reload may be required by the extension.' };
			}
			const extension = api.extensions.getExtension(input.extensionId);
			if (!extension) { throw new Error('Extension is not installed'); }
			if (!['activateExtension', 'extensionCommand'].includes(input.action)) { throw new Error('Unsupported IDE action'); }
			const declared = extension.packageJSON.contributes?.commands || [];
			if (input.action === 'extensionCommand' && !declared.some(command => command.command === input.commandId)) { throw new Error('Command is not declared by that extension'); }
			if (!await approve('Use extension (may execute third-party code)', { extensionId: extension.id, commandId: input.commandId || 'activate' })) { throw new Error('Extension action declined'); }
			requireTrusted(); await extension.activate();
			if (input.action === 'extensionCommand') { await api.commands.executeCommand(input.commandId); }
			return { completed: true, extensionId: extension.id, commandId: input.commandId || null, commands: declared.slice(0, 50) };
		}
	};
}
module.exports = { createIdeTools, toolDefinitions };
