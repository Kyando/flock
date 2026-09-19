import { h, svg } from './dom.ts';
import { ICONS } from './icons.ts';

let toastEl: HTMLElement | null = null;
let toastTimer = 0;

/** Short message under the header, Termo-style. */
export function toast(message: string, ms = 2200): void {
  toastEl ??= document.body.appendChild(h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }));
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('is-visible'), ms);
}

export interface ModalOptions {
  title: string;
  body: Node;
  actions?: Node[];
  className?: string;
  onClose?: () => void;
}

export function openModal({ title, body, actions, className, onClose }: ModalOptions): { close(): void } {
  const dialog = h('dialog', { class: `modal ${className ?? ''}` });
  const close = () => dialog.close();
  dialog.append(
    h(
      'div',
      { class: 'modal-inner' },
      h('button', { type: 'button', class: 'icon-btn modal-close', 'aria-label': 'Fechar', onclick: close }, svg(ICONS.close)),
      h('h2', {}, title),
      body,
      actions?.length ? h('div', { class: 'modal-actions' }, ...actions) : null,
    ),
  );
  // Clicks on the backdrop land on the <dialog> itself.
  dialog.addEventListener('click', (e) => e.target === dialog && close());
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  document.body.append(dialog);
  dialog.showModal();
  return { close };
}
