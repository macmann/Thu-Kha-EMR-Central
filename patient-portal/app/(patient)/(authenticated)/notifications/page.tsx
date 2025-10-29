export const dynamic = 'force-dynamic';

import { Card, Stack } from '@mui/material';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { fetchPatientNotifications } from '@/lib/api';
import { NotificationsFeed } from '@/components/patient-notifications/NotificationsFeed';
import { cardSurface } from '@/components/patient/PatientSurfaces';

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
    redirect('/login');
  }

  return (
    <Stack spacing={3}>
      <Card elevation={0} sx={(theme) => cardSurface(theme, { compact: true })}>
        <NotificationsFeed
          initialNotifications={notificationsResponse.notifications}
          initialUnreadCount={notificationsResponse.unreadCount}
        />
      </Card>
    </Stack>
  );
}
