type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

/** Minimal element builder. `on*` attributes become listeners. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = String(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) el.append(child);
  return el;
}

/** Renders a word/clue icon: an emoji, or an image asset path (public/). */
export function icon(value: string, className: string): HTMLElement {
  if (/\.(svg|png|webp)$/i.test(value)) {
    return h('img', { class: `${className} is-image`, src: value, alt: '', draggable: 'false' });
  }
  return h('span', { class: className, 'aria-hidden': 'true' }, value);
}

/** Parses a trusted inline SVG string (our own icon set). */
export function svg(markup: string): SVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  return tpl.content.firstElementChild as SVGElement;
}

/** Label with a font scale that keeps its longest word from breaking mid-word. */
export function label(text: string, className: string, comfortable = 8): HTMLElement {
  const longest = Math.max(...text.split(/[\s-]+/).map((w) => w.length));
  const scale = Math.min(1, comfortable / longest);
  return h('span', { class: className, style: `--fit: ${scale.toFixed(2)}` }, text);
}

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
