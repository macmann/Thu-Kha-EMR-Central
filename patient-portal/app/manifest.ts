import type { MetadataRoute } from 'next';

const iconSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Thu Kha Patient Portal icon">
    <defs>
      <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0%" stop-color="#14b8a6" />
        <stop offset="100%" stop-color="#0d9488" />
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="24" fill="url(#bg)" />
    <path
      fill="#ffffff"
      d="M64 28c-16.016 0-29 12.984-29 29s12.984 29 29 29 29-12.984 29-29S80.016 28 64 28Zm0 48c-10.493 0-19-8.507-19-19s8.507-19 19-19 19 8.507 19 19-8.507 19-19 19Zm0 10c-18.225 0-34.392 9.507-43.477 24.002A4 4 0 0 0 24 112h80a4 4 0 0 0 3.477-6.998C98.392 95.507 82.225 86 64 86Z"
    />
  </svg>
`;

const iconDataUrl = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Thu Kha Patient Portal',
    short_name: 'Patient Portal',
    description: 'Check appointments, visits, and personal information from any clinic-enabled device.',
    start_url: '/patient',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#14b8a6',
    icons: [
      {
        src: iconDataUrl,
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: iconDataUrl,
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: iconDataUrl,
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
