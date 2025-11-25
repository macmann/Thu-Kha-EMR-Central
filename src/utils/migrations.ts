import { spawn } from 'node:child_process';

let migrationsPromise: Promise<void> | null = null;

function runMigrations(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/migrate-deploy.js'], {
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`migrate:deploy exited with status ${code}`));
      }
    });
  });
}

/**
 * Ensure migrations have been applied. Only one migrate:deploy process is allowed
 * to run at a time, and subsequent calls will reuse the in-flight promise.
 */
export function ensureMigrationsApplied(): Promise<void> {
  if (!migrationsPromise) {
    migrationsPromise = runMigrations().catch((error) => {
      migrationsPromise = null;
      throw error;
    });
  }

  return migrationsPromise;
}
