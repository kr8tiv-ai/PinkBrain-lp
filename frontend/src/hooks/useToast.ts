import { useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let globalId = 0;

const listeners = new Set<(toast: Toast) => void>();

export function pushToast(type: ToastType, message: string) {
  const toast: Toast = { id: ++globalId, type, message };
  listeners.forEach((fn) => fn(toast));
}

export function useToast(autoDismissMs = 5000) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (toast: Toast) => {
      setToasts((prev) => [...prev.slice(-4), toast]);
      const timer = setTimeout(() => dismiss(toast.id), autoDismissMs);
      timers.current.set(toast.id, timer);
    },
    [autoDismissMs, dismiss],
  );

  // Subscribe to global pushes
  const subscribeRef = useRef(false);
  if (!subscribeRef.current) {
    subscribeRef.current = true;
    listeners.add(addToast);
  }

  return { toasts, dismiss, addToast };
}
