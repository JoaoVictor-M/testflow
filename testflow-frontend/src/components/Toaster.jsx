import { resolveValue, useToaster } from 'react-hot-toast/headless';

const SYMBOLS = { success: '✓', error: '✕' };

// Draws the notifications with Tailwind classes. The ready-made Toaster of react-hot-toast writes <style>
// elements at run time, which a Content Security Policy without 'unsafe-inline' refuses.
export default function Toaster() {
  const { toasts, handlers } = useToaster({ duration: 4000 });

  return (
    <div
      aria-label="Notificações"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
      onMouseEnter={handlers.startPause}
      onMouseLeave={handlers.endPause}
    >
      {toasts.filter((toast) => toast.visible).map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className="flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span aria-hidden="true">{toast.icon ?? SYMBOLS[toast.type]}</span>
          <span>{resolveValue(toast.message, toast)}</span>
        </div>
      ))}
    </div>
  );
}
