import { resolveValue, useToaster } from 'react-hot-toast/headless';

const SYMBOLS = { success: '✓', error: '✕' };

// Draws the notifications with Tailwind classes. The ready-made Toaster of react-hot-toast writes <style>
// elements at run time, which a Content Security Policy without 'unsafe-inline' refuses. The stack is as wide as
// the screen allows (up to a readable width) and a long message wraps inside it.
export default function Toaster() {
  const { toasts, handlers } = useToaster({ duration: 4000 });

  return (
    <div
      aria-label="Notificações"
      className="fixed bottom-4 right-4 z-[9999] flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:max-w-sm"
      onMouseEnter={handlers.startPause}
      onMouseLeave={handlers.endPause}
    >
      {toasts.filter((toast) => toast.visible).map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className="flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span aria-hidden="true" className="shrink-0">{toast.icon ?? SYMBOLS[toast.type]}</span>
          <span className="min-w-0 break-words">{resolveValue(toast.message, toast)}</span>
        </div>
      ))}
    </div>
  );
}
