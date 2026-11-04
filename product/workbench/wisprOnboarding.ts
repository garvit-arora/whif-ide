/*---------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { encodeBase64 } from '../../../../base/common/buffer.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IOnboardingService } from '../../welcomeOnboarding/common/onboardingService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

/** Wispr opens the coding terminal without the upstream Copilot sign-in wizard. */
export class WisprOnboarding extends Disposable implements IOnboardingService {
	declare readonly _serviceBrand: undefined;
	private readonly dismissed = this._register(new Emitter<void>());
	readonly onDidDismiss = this.dismissed.event;

	constructor(@ICommandService private readonly commands: ICommandService) {
		super();
	}

	show(): void {
		void this.commands.executeCommand('wispr.open').then(() => this.dismissed.fire(), () => this.dismissed.fire());
	}
}

/** Supplies only the current IDE window to the approval-gated voice screen tool. */
class WisprScreenContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.wisprScreen';

	constructor(@IHostService host: IHostService) {
		super();
		this._register(CommandsRegistry.registerCommand('wispr.captureIdeWindow', async () => {
			const image = await host.getScreenshot();
			if (!image || image.byteLength > 8 * 1024 * 1024) {
				return undefined;
			}
			return { imageUrl: `data:image/png;base64,${encodeBase64(image)}` };
		}));
	}
}

registerWorkbenchContribution2(WisprScreenContribution.ID, WisprScreenContribution, WorkbenchPhase.AfterRestored);
