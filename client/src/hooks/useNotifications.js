/**
 * useNotifications — convenience exports for notification hooks.
 *
 * Re-exports both contexts so components import from one place:
 *   import { useToast, useNotificationData } from '../../hooks/useNotifications';
 */
export { useToast } from '../context/ToastContext';
export { useNotificationData } from '../context/NotificationContext';
