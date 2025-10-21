export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { fetchPatientNotifications } from '@/lib/api';
import { NotificationsFeed } from '@/components/patient-notifications/NotificationsFeed';

function serializeCookies(): string | undefined {
  const store = cookies();
  const entries = store.getAll();
  if (entries.length === 0) {
    return undefined;
  }
  return entries.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

export default async function PatientNotificationsPage() {
  const cookieHeader = serializeCookies();
  const notificationsResponse = await fetchPatientNotifications({ cookie: cookieHeader, limit: 50 });

  if (!notificationsResponse) {
    redirect('/patient/login');
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <NotificationsFeed
        initialNotifications={notificationsResponse.notifications}
        initialUnreadCount={notificationsResponse.unreadCount}
      />
    </main>
  );
}
