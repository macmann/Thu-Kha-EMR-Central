'use client';

import type { PatientVisitDetail } from '@/lib/api';
import DoctorNoteViewer from './DoctorNoteViewer';

type DoctorNotesGalleryProps = {
  notes: PatientVisitDetail['doctorNotes'];
  patientName: string;
  visitDate: string;
};

function formatWatermarkDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

export default function DoctorNotesGallery({ notes, patientName, visitDate }: DoctorNotesGalleryProps) {
  const watermark = `${patientName} • ${formatWatermarkDate(visitDate)}`;

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      {notes.map((note) => (
        <DoctorNoteViewer key={note.id} note={note} watermark={watermark} />
      ))}
    </div>
  );
}
