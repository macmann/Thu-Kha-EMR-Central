'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

function formatTimestamp(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date);
}

export default function DoctorNotesGallery({ notes, patientName, visitDate }: DoctorNotesGalleryProps) {
  const watermark = useMemo(() => `${patientName} • ${formatWatermarkDate(visitDate)}`, [patientName, visitDate]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex]);

  const openNote = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const closeViewer = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const activeNote = activeIndex !== null ? notes[activeIndex] ?? null : null;

  return (
    <>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note, index) => (
          <button
            key={note.id}
            type="button"
            onClick={() => openNote(index)}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-md"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-200">
              <img
                src={`/api/patient/docs/${note.id}`}
                alt={note.fileName ?? 'Doctor note preview'}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-xs font-medium uppercase tracking-wide text-white">
                View note
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="text-sm font-semibold text-slate-900">{note.fileName ?? 'Doctor note'}</p>
              <p className="text-xs text-slate-500">Uploaded {formatTimestamp(note.createdAt)}</p>
              {note.extractedText ? (
                <p className="max-h-20 overflow-hidden whitespace-pre-wrap text-xs text-slate-600">
                  {note.extractedText.trim()}
                </p>
              ) : (
                <p className="text-xs italic text-slate-400">No text extracted</p>
              )}
            </div>
          </button>
        ))}
      </div>

      <DoctorNoteViewer note={activeNote} watermark={watermark} onClose={closeViewer} />
    </>
  );
}
