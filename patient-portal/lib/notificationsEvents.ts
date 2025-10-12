export const PATIENT_NOTIFICATIONS_UNREAD_EVENT = 'patient-notifications:unread-count';

export function emitUnreadNotificationCount(count: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(PATIENT_NOTIFICATIONS_UNREAD_EVENT, {
      detail: { count },
    }),
  );
}
