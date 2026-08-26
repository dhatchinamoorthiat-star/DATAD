/**
 * toast — the single source of truth for user-facing notifications.
 *
 * Every toast in the app goes through this module. Components may either
 * import it directly:
 *
 *   import toast from '../utils/toast';
 *   toast.success('Saved');
 *
 * ...or use the React binding in `context/ToastContext`, which simply
 * delegates here. Both paths share one config, one style, one dedup table.
 *
 * Canonical variants: success | error | warning | info | loading
 *
 * Async work should use the `withToast` helper, which suppresses the loading
 * toast for operations that finish quickly so fast actions don't flash a
 * spinner, and always clears it once the operation settles.
 */

import { createElement as h } from 'react';
import hotToast from 'react-hot-toast';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

// ── Variant configs ─────────────────────────────────────────────────────
// Durations are tuned so errors linger long enough to read and act on.
//
// `glyph` is a lucide component, not an emoji. Toasts are the most-seen
// chrome in the product — every save, every error — and an emoji here was
// drawn by the reader's own OS font, so the same confirmation looked like a
// different product on a Mac, a Windows laptop and an Android phone. It is
// rendered in the variant's border colour, which is already tuned to sit on
// that variant's background.
const VARIANTS = {
  success: { glyph: CheckCircle2,  duration: 3000,      bg: '#065f46', border: '#10b981' },
  error:   { glyph: XCircle,       duration: 5000,      bg: '#881337', border: '#f43f5e' },
  warning: { glyph: AlertTriangle, duration: 6000,      bg: '#78350f', border: '#f59e0b' },
  info:    { glyph: Info,          duration: 4000,      bg: '#1e3a5f', border: '#3b82f6' },
  loading: { glyph: null,          duration: Infinity,  bg: '#1f2937', border: '#6b7280' },
};

/** The variant's icon as a renderable node, or null for `loading`. */
function variantIcon(variant) {
  if (!variant.glyph) return null;
  return h(variant.glyph, {
    size: 18,
    color: variant.border,
    'aria-hidden': true,
    style: { flexShrink: 0 },
  });
}

const DEFAULT_VARIANT = 'info';

/** Operations faster than this never show a loading toast. */
export const LOADING_THRESHOLD_MS = 500;

function buildStyle(variant) {
  return {
    background: variant.bg,
    color: '#ffffff',
    border: `1px solid ${variant.border}`,
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 500,
    maxWidth: '420px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  };
}

/**
 * Derive a stable id from the variant + message so that firing the same
 * notification twice replaces the existing toast instead of stacking a
 * duplicate. Callers that genuinely want two copies pass an explicit
 * `id`, or `dedupe: false`.
 */
function autoId(type, message) {
  const text = typeof message === 'string' ? message : '';
  return `${type}:${text}`;
}

function show(type, message, opts = {}) {
  const variant = VARIANTS[type] || VARIANTS[DEFAULT_VARIANT];
  const { action, dedupe = true, id, icon, duration, ...rest } = opts;

  // `duration: 0` means "persist until dismissed". Treat it explicitly so it
  // isn't swallowed by a falsy check and replaced with the default.
  const resolvedDuration = duration === 0
    ? Infinity
    : (duration ?? variant.duration);

  const config = {
    ...rest,
    id: id ?? (dedupe ? autoId(type, message) : undefined),
    duration: resolvedDuration,
    style: buildStyle(variant),
  };

  // `loading` supplies its own spinner; don't override it. An explicit `icon`
  // from the caller still wins, and may be any node react-hot-toast accepts.
  const resolvedIcon = icon ?? variantIcon(variant);
  if (resolvedIcon) config.icon = resolvedIcon;

  if (type === 'loading') return hotToast.loading(message, config);

  if (action) {
    return hotToast((t) => renderWithAction(t, resolvedIcon, message, action), config);
  }

  return hotToast(message, config);
}

function renderWithAction(t, icon, message, action) {
  // Kept as createElement calls so this module stays a plain .js file.
  return h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
    icon ? h('span', { key: 'i' }, icon) : null,
    h('span', { key: 'm', style: { flex: 1 } }, message),
    h('button', {
      key: 'b',
      onClick: () => { hotToast.dismiss(t.id); action.onClick(); },
      style: {
        background: 'rgba(255,255,255,0.15)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '8px',
        padding: '4px 12px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
    }, action.label),
  ]);
}

// ── Public API ──────────────────────────────────────────────────────────
// Shaped to match react-hot-toast's default export so existing call sites
// keep working after only changing their import path.

const toast = {
  success: (msg, opts) => show('success', msg, opts),
  error:   (msg, opts) => show('error', msg, opts),
  warning: (msg, opts) => show('warning', msg, opts),
  info:    (msg, opts) => show('info', msg, opts),
  loading: (msg, opts) => show('loading', msg, opts),

  /** Escape hatch used by notification fan-out: `show(msg, type, opts)`. */
  show: (msg, type, opts) => show(type, msg, opts),

  dismiss: (id) => hotToast.dismiss(id),
  remove: (id) => hotToast.remove(id),
  dismissAll: () => hotToast.dismiss(),
  custom: (...args) => hotToast.custom(...args),
};

/**
 * Wrap an async operation with standard loading/success/error feedback.
 *
 * The loading toast only appears if the promise is still pending after
 * LOADING_THRESHOLD_MS, so sub-500ms actions show just the success toast.
 * The loading toast is always dismissed, including on failure, so nothing
 * lingers after the operation settles.
 *
 *   await withToast(() => api.save(form), {
 *     loading: 'Saving…',
 *     success: 'Saved',
 *     error: (e) => e.response?.data?.message || 'Could not save',
 *   });
 */
export async function withToast(fn, messages = {}) {
  const { loading, success, error, id } = messages;
  const toastId = id || `op:${loading || success || 'async'}`;
  let timer = null;
  let shown = false;

  if (loading) {
    timer = setTimeout(() => {
      shown = true;
      toast.loading(loading, { id: toastId });
    }, LOADING_THRESHOLD_MS);
  }

  const clear = () => {
    if (timer) clearTimeout(timer);
    if (shown) toast.dismiss(toastId);
  };

  try {
    const result = await fn();
    clear();
    if (success) {
      toast.success(typeof success === 'function' ? success(result) : success);
    }
    return result;
  } catch (err) {
    clear();
    if (error !== false) {
      toast.error(resolveErrorMessage(err, error));
    }
    throw err;
  }
}

/**
 * Turn an API failure into something a user can act on. Prefers the
 * server's message, falls back to a network-aware default rather than a
 * bare "Error".
 */
export function resolveErrorMessage(err, override) {
  if (typeof override === 'function') return override(err);
  if (typeof override === 'string') return override;

  const serverMessage = err?.response?.data?.message || err?.response?.data?.error;
  if (serverMessage) return serverMessage;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return "You're offline — reconnect and try again";
  }
  if (err?.code === 'ECONNABORTED') return 'The request timed out — please try again';
  if (!err?.response) return 'Network error — check your connection and try again';

  const status = err.response.status;
  if (status === 401) return 'Your session expired — please sign in again';
  if (status === 403) return "You don't have permission to do that";
  if (status === 404) return 'That item no longer exists';
  if (status === 429) return 'Too many requests — wait a moment and try again';
  if (status >= 500) return 'Something went wrong on our end — please try again';

  return err?.message || 'Something went wrong';
}

export default toast;
