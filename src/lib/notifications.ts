import type { NotificationRecord } from '../types/app';

export function isNotificationVisibleToday(notification: Pick<NotificationRecord, 'visible_from' | 'visible_to'>) {
  const today = new Date().toISOString().slice(0, 10);
  return (!notification.visible_from || notification.visible_from <= today) && (!notification.visible_to || notification.visible_to >= today);
}

export function filterVisibleNotifications<T extends Pick<NotificationRecord, 'visible_from' | 'visible_to'>>(notifications: T[], limit?: number) {
  const visible = notifications.filter(isNotificationVisibleToday);
  return typeof limit === 'number' ? visible.slice(0, limit) : visible;
}
