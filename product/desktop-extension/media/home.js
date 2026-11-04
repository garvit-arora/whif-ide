/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const vscode = acquireVsCodeApi();
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => vscode.postMessage({ action: button.dataset.action })));
