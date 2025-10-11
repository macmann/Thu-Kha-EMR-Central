'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PatientVisitDetail } from '@/lib/api';

const MAX_SCALE = 4;
const MIN_SCALE = 1;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type DoctorNoteViewerProps = {
  note: PatientVisitDetail['doctorNotes'][number];
  watermark: string;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date);
}

export default function DoctorNoteViewer({ note, watermark }: DoctorNoteViewerProps) {
  const pointersRef = useRef(new Map<number, PointerEvent>());
  const panState = useRef<{ startX: number; startY: number; startTranslate: { x: number; y: number } } | null>(null);
  const pinchState = useRef<{ startDistance: number; startScale: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    let revokedUrl: string | null = null;

    fetch(`/api/patient/docs/${note.id}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load doctor note');
        }
        return response.blob();
      })
      .then((blob) => {
        revokedUrl = URL.createObjectURL(blob);
        setObjectUrl(revokedUrl);
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to display doctor note');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
      setObjectUrl(null);
    };
  }, [note.id]);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, event.nativeEvent);

    if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
      pinchState.current = { startDistance: distance, startScale: scale };
    } else if (pointersRef.current.size === 1 && scale > 1) {
      panState.current = {
        startX: event.clientX,
        startY: event.clientY,
        startTranslate: { ...translate },
      };
    }
  }, [scale, translate]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }
    pointersRef.current.set(event.pointerId, event.nativeEvent);

    if (pointersRef.current.size === 2 && pinchState.current) {
      const [first, second] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
      const ratio = distance / pinchState.current.startDistance;
      const nextScale = clamp(pinchState.current.startScale * ratio, MIN_SCALE, MAX_SCALE);
      setScale(nextScale);
      if (nextScale === 1) {
        setTranslate({ x: 0, y: 0 });
      }
    } else if (pointersRef.current.size === 1 && panState.current && scale > 1) {
      const dx = event.clientX - panState.current.startX;
      const dy = event.clientY - panState.current.startY;
      setTranslate({
        x: panState.current.startTranslate.x + dx,
        y: panState.current.startTranslate.y + dy,
      });
    }
  }, [scale]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    target.releasePointerCapture(event.pointerId);
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size < 2) {
      pinchState.current = null;
    }
    if (pointersRef.current.size === 0) {
      panState.current = null;
    }
  }, []);

  const transformStyle = useMemo(
    () => ({
      transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
    }),
    [scale, translate.x, translate.y],
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-300">Loading…</div>
        ) : null}
        {error ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        {!loading && !error && objectUrl ? (
          <>
            <img
              src={objectUrl}
              alt={note.fileName ?? 'Doctor note'}
              className="absolute left-1/2 top-1/2 h-auto w-full max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
              style={transformStyle}
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="select-none text-2xl font-bold uppercase tracking-[0.3em] text-white/25 drop-shadow-md [transform:rotate(-25deg)]">
                {watermark}
              </span>
            </div>
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-500">
          <p className="font-medium text-slate-700">{note.fileName ?? 'Doctor note'}</p>
          <p>
            {formatFileSize(note.size)} • Uploaded {formatTimestamp(note.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={resetView}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
        >
          Reset view
        </button>
      </div>
    </div>
  );
}
