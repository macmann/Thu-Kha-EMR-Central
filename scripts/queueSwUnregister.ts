import { promises as fs } from 'node:fs';
import path from 'node:path';

async function queueServiceWorkerUnregister() {
  const flagPath = path.resolve(process.cwd(), 'patient-portal', '.force-sw-unregister');

  await fs.writeFile(flagPath, `${Date.now()}`, { encoding: 'utf8' });

  console.log('Queued patient portal service worker unregister for the next page load.');
  console.log(`Flag file created at: ${flagPath}`);
}

queueServiceWorkerUnregister().catch((error) => {
  console.error('Failed to queue service worker unregister flag.', error);
  process.exit(1);
});
