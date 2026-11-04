/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
import { useEffect, useState } from 'react';

export function useHeroMotion(root) {
	const [enabled, setEnabled] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
	useEffect(() => {
		const preference = matchMedia('(prefers-reduced-motion: reduce)');
		const update = () => setEnabled(!preference.matches);
		preference.addEventListener('change', update);
		return () => preference.removeEventListener('change', update);
	}, []);
	useEffect(() => {
		const panel = root.current.querySelector('.pastel-panel');
		const word = root.current.querySelector('#cycling-word');
		const icon = root.current.querySelector('.candy-icon');
		const words = ['Build', 'Speak', 'Shape', 'Create'];
		const symbols = ['✳', '●', '✦', '◎'];
		const clock = panel.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 7000, iterations: Infinity });
		let frame;
		function draw() {
			const elapsed = Number(clock.currentTime || 0) % 7000;
			const slot = Math.floor(elapsed / 1750), phase = elapsed % 1750;
			word.textContent = words[slot]; icon.firstElementChild.textContent = symbols[slot];
			panel.dataset.tone = String(slot); icon.dataset.shape = String(slot);
			const enter = 1 - (1 - Math.min(1, phase / 500)) ** 3;
			const leave = Math.max(0, (phase - 1330) / 420) ** 3;
			word.style.opacity = String(enter * (1 - leave));
			word.style.transform = `translateY(${(1 - enter) * .32 - leave * .16}em)`;
			word.style.filter = `blur(${(1 - enter) * 10 + leave * 8}px)`;
			const iconEnter = Math.min(1, Math.max(0, (phase - 60) / 440));
			icon.style.opacity = String(iconEnter * (1 - leave));
			icon.style.transform = `translateY(${Math.sin(elapsed / 900) * .028}em) scale(${.7 + .3 * iconEnter}) rotate(${-14 * (1 - iconEnter) + Math.sin(elapsed / 800) * 3}deg)`;
			frame = requestAnimationFrame(draw);
		}
		function sync() {
			cancelAnimationFrame(frame);
			if (enabled && !document.hidden) { clock.play(); draw(); }
			else { clock.pause(); }
		}
		if (!enabled) {
			word.textContent = words[0]; icon.firstElementChild.textContent = symbols[0]; panel.dataset.tone = '0'; icon.dataset.shape = '0';
			for (const element of [word, icon]) { element.style.opacity = '1'; element.style.transform = 'none'; element.style.filter = 'none'; }
		}
		sync(); document.addEventListener('visibilitychange', sync);
		return () => { clock.cancel(); cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', sync); };
	}, [enabled, root]);
	return [enabled, () => setEnabled(value => !value)];
}
