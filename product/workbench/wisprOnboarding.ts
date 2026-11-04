/*---------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IOnboardingService } from '../../welcomeOnboarding/common/onboardingService.js';

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
