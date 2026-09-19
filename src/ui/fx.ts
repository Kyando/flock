import { reducedMotion } from './dom.ts';

/** FLIP: animates an element from where it was (`first`) to where it is now. */
export function flip(el: HTMLElement, first: DOMRect, duration = 340): void {
  if (reducedMotion()) return;
  const last = el.getBoundingClientRect();
  if (!last.width || !last.height) return;
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01) return;
  el.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: 'translate(0, 0) scale(1, 1)' }],
    { duration, easing: 'cubic-bezier(.22, 1.2, .36, 1)' },
  );
}

/** Restarts a CSS animation class. */
export function replay(el: Element, className: string): void {
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
}

/** Emoji confetti bursting from a point. */
export function burst(x: number, y: number, glyphs: string[], amount = 22): void {
  if (reducedMotion()) return;
  for (let i = 0; i < amount; i++) {
    const s = document.createElement('span');
    s.className = 'particle';
    s.textContent = glyphs[i % glyphs.length];
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    document.body.append(s);
    const angle = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 170;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 60;
    const rot = (Math.random() - 0.5) * 540;
    s.animate(
      [
        { transform: 'translate(-50%, -50%) scale(.3)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(1.15) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 120}px)) scale(.8) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' },
    ).onfinish = () => s.remove();
  }
}
