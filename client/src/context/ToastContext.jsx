/**
 * ToastContext — React binding for the shared toast module.
 *
 * This is a thin wrapper around `utils/toast`; all variant config, styling,
 * deduplication and async helpers live there so that components importing
 * the module directly and components using this hook behave identically.
 *
 * Prefer this hook inside components (it keeps toast usage visible in the
 * dependency graph); import `utils/toast` directly from non-React modules.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved!');
 *   toast.error('Failed', { duration: 5000 });
 *   await toast.withToast(() => api.save(), { loading: 'Saving…', success: 'Saved' });
 */

import { createContext, useContext, useMemo } from 'react';
import toast, { withToast, resolveErrorMessage } from '../utils/toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  // The underlying module is a stable singleton, so this value never needs
  // to change identity — consumers can safely list `toast` in dep arrays
  // without re-running their effects.
  const value = useMemo(() => ({
    success: toast.success,
    error: toast.error,
    warning: toast.warning,
    info: toast.info,
    loading: toast.loading,
    show: toast.show,
    dismiss: toast.dismiss,
    dismissAll: toast.dismissAll,
    withToast,
    resolveErrorMessage,
  }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export default ToastContext;
