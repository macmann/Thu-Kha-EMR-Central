'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import type { PatientVisitHistoryResponse, PatientVisitSummary } from '@/lib/api';
import { cardSurface, softBadge } from '../patient/PatientSurfaces';

function formatVisitDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

type VisitsPageProps = {
  initialData: PatientVisitHistoryResponse | null;
};

export default function VisitsPage({ initialData }: VisitsPageProps) {
  const [visits, setVisits] = useState<PatientVisitSummary[]>(initialData?.visits ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initialData?.nextCursor ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const isEmpty = !initialData || visits.length === 0;

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('cursor', nextCursor);
      const response = await fetch(`/api/patient/history/visits?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load additional visits');
      }
      const data = (await response.json()) as PatientVisitHistoryResponse;
      setVisits((prev) => {
        const known = new Set(prev.map((visit) => visit.id));
        const merged = [...prev];
        for (const visit of data.visits) {
          if (!known.has(visit.id)) {
            merged.push(visit);
            known.add(visit.id);
          }
        }
        return merged;
      });
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load more visits');
    } finally {
      setLoading(false);
    }
  }, [nextCursor, loading]);

  useEffect(() => {
    if (!nextCursor) {
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [loadMore, nextCursor]);

  const headerSummary = useMemo(() => {
    if (!visits.length) {
      return 'No visits yet';
    }
    const clinics = new Set(visits.map((visit) => visit.clinic?.name ?? 'Clinic'));
    return `${visits.length} visit${visits.length === 1 ? '' : 's'} across ${clinics.size} clinic${clinics.size === 1 ? '' : 's'}`;
  }, [visits]);

  return (
    <Stack spacing={3}>
      <Card elevation={0} sx={(theme) => cardSurface(theme)}>
        <Stack spacing={1.5}>
          <Typography variant="h5" fontWeight={700}>
            Your visit history
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialData ? headerSummary : 'Unable to load visits right now. Please try again later.'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Scroll down to load more records automatically.
          </Typography>
        </Stack>
      </Card>

      {error ? (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      ) : null}

      {isEmpty ? (
        <Card elevation={0} sx={(theme) => ({
          ...cardSurface(theme, { compact: true }),
          textAlign: 'center',
          color: theme.palette.text.secondary,
        })}
        >
          Once clinics grant access, your visit history will appear here.
        </Card>
      ) : (
        <Stack spacing={2.5}>
          {visits.map((visit) => (
            <Card
              key={visit.id}
              elevation={0}
              sx={(theme) => ({
                ...cardSurface(theme, { compact: true }),
                transition: theme.transitions.create(['transform', 'box-shadow']),
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 24px 40px rgba(13,148,136,0.22)',
                },
              })}
            >
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="overline" color="primary" fontWeight={600} sx={{ letterSpacing: 1 }}>
                      {visit.clinic?.name ?? 'Clinic'}
                    </Typography>
                    <Typography variant="h6">{formatVisitDate(visit.visitDate)}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {visit.doctor ? (
                      <Chip
                        label={visit.doctor.name}
                        size="small"
                        sx={(theme) => ({
                          backgroundColor: alpha(theme.palette.text.primary, 0.08),
                          color: theme.palette.text.primary,
                          fontWeight: 500,
                        })}
                      />
                    ) : null}
                    {visit.hasDoctorNote ? (
                      <Box sx={(theme) => softBadge(theme, 'success')}>Doctor note available</Box>
                    ) : null}
                  </Stack>
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  {visit.diagnosisSummary || 'No diagnosis summary.'}
                </Typography>

                <Divider sx={{ borderColor: 'divider' }} />

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 2, sm: 1.5 }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Next visit:{' '}
                    <Typography component="span" variant="body2" fontWeight={600} color="text.primary">
                      {visit.nextVisitDate ? formatVisitDate(visit.nextVisitDate) : 'Not scheduled'}
                    </Typography>
                  </Typography>
                  <Typography
                    component={Link}
                    href={`/patient/visits/${visit.id}`}
                    variant="button"
                    sx={(theme) => ({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      color: theme.palette.primary.main,
                      textDecoration: 'none',
                      fontWeight: 600,
                      '&:hover': { textDecoration: 'underline' },
                    })}
                  >
                    View visit details
                  </Typography>
                </Stack>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}

      <Box ref={sentinelRef} aria-hidden sx={{ height: 4 }} />
      {loading ? (
        <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" sx={{ color: 'text.secondary' }}>
          <CircularProgress size={18} thickness={4} />
          <Typography variant="caption" color="text.secondary">
            Loading more visits…
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}
