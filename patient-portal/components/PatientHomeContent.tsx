'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Grid,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

import type { ClinicSummary } from '@/lib/api';
import { cardSurface, heroSurface, subtlePanel } from './patient/PatientSurfaces';

type Props = {
  clinics: ClinicSummary[];
};

const QUICK_ACTIONS = [
  {
    href: '/consent',
    icon: ClipboardList,
    translationKey: 'actions.manageConsent',
  },
  {
    href: '/visits',
    icon: FileText,
    translationKey: 'actions.viewVisits',
  },
  {
    href: '/appointments',
    icon: CalendarCheck,
    translationKey: 'actions.manageAppointments',
  },
  {
    href: '/invoices',
    icon: HeartPulse,
    translationKey: 'actions.reviewInvoices',
  },
] as const satisfies ReadonlyArray<{
  href: Route;
  icon: LucideIcon;
  translationKey: string;
}>;

export function PatientHomeContent({ clinics }: Props) {
  const { t } = useTranslation();

  return (
    <Stack spacing={{ xs: 5, md: 7 }}>
      <Box sx={(theme) => heroSurface(theme)}>
        <Stack spacing={{ xs: 4, lg: 6 }} direction={{ xs: 'column', lg: 'row' }} alignItems="stretch">
          <Stack spacing={3} flex={1} justifyContent="center">
            <Chip
              icon={<Sparkles size={14} aria-hidden />}
              label={t('home.heroGreeting')}
              sx={(theme) => ({
                alignSelf: 'flex-start',
                backgroundColor: alpha(theme.palette.common.white, 0.18),
                color: alpha(theme.palette.common.white, 0.8),
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
              })}
            />
            <Stack spacing={1.5}>
              <Typography variant="h3" component="h1" fontWeight={700} sx={{ maxWidth: 540 }}>
                {t('home.heroHeadline')}
              </Typography>
              <Typography variant="body1" sx={{ maxWidth: 520, color: 'rgba(255,255,255,0.82)' }}>
                {t('home.heroDescription')}
              </Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} flexWrap="wrap">
              <Button
                component={Link}
                href="/appointments"
                size="large"
                color="inherit"
                sx={(theme) => ({
                  alignSelf: { xs: 'stretch', sm: 'flex-start' },
                  px: 3,
                  py: 1.5,
                  borderRadius: 999,
                  color: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.common.white, 0.94),
                  boxShadow: '0 20px 40px rgba(15, 118, 110, 0.25)',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.common.white, 0.98),
                    transform: 'translateY(-2px)',
                  },
                  '& .MuiButton-startIcon': { mr: 1 },
                })}
                startIcon={<CalendarCheck size={18} aria-hidden />}
              >
                {t('home.heroPrimaryCta')}
              </Button>
              <Button
                component={Link}
                href="/consent"
                size="large"
                variant="outlined"
                color="inherit"
                sx={{
                  alignSelf: { xs: 'stretch', sm: 'flex-start' },
                  px: 3,
                  py: 1.5,
                  borderRadius: 999,
                  borderColor: alpha('#ffffff', 0.55),
                  color: 'rgba(255,255,255,0.92)',
                  '&:hover': {
                    borderColor: alpha('#ffffff', 0.8),
                    backgroundColor: alpha('#ffffff', 0.18),
                  },
                }}
                startIcon={<ShieldCheck size={18} aria-hidden />}
              >
                {t('home.heroSecondaryCta')}
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={2.5} flex={1} columns={{ xs: 1, sm: 3, lg: 1 }}>
            <Grid item xs={1} sm={1} lg={1}>
              <Card elevation={0} sx={(theme) => subtlePanel(theme)}>
                <Typography variant="h4" fontWeight={700} color="common.white">
                  {clinics.length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                  {t('home.heroStatClinics', { count: clinics.length })}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={1} sm={1} lg={1}>
              <Card elevation={0} sx={(theme) => subtlePanel(theme)}>
                <Typography variant="body2" fontWeight={600} color="common.white">
                  {t('home.heroStatSupport')}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={1} sm={1} lg={1}>
              <Card elevation={0} sx={(theme) => subtlePanel(theme)}>
                <Typography variant="body2" fontWeight={600} color="common.white">
                  {t('home.heroStatPrivacy')}
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      </Box>

      <Grid container spacing={3} columns={6}>
        <Grid item xs={6} lg={2.5}>
          <Card elevation={0} sx={(theme) => cardSurface(theme, { compact: true })}>
            <Stack spacing={3}>
              <Stack spacing={1}>
                <Typography variant="h6">{t('home.quickActionsHeading')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('home.quickActionsDescription')}
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                {QUICK_ACTIONS.map(({ href, icon: Icon, translationKey }) => (
                  <Grid item xs={12} sm={6} key={href}>
                    <Card
                      component={MuiLink}
                      href={href}
                      elevation={0}
                      sx={(theme) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        padding: theme.spacing(2),
                        borderRadius: 20,
                        textDecoration: 'none',
                        border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.4 : 0.18)}`,
                        backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.65 : 0.98),
                        color: theme.palette.primary.main,
                        transition: theme.transitions.create(['box-shadow', 'transform']),
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 18px 30px rgba(13,148,136,0.25)',
                        },
                      })}
                    >
                      <Avatar
                        variant="rounded"
                        sx={(theme) => ({
                          width: 40,
                          height: 40,
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          color: theme.palette.primary.main,
                          transition: theme.transitions.create(['background-color', 'color']),
                          '.MuiCard-root:hover &': {
                            bgcolor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                          },
                        })}
                      >
                        <Icon size={18} aria-hidden />
                      </Avatar>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {t(translationKey)}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', ml: 'auto' }}>
                        <ArrowRight size={16} aria-hidden />
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="caption" color="text.secondary">
                {t('home.shareSettings')}
              </Typography>
            </Stack>
          </Card>
        </Grid>

        <Grid item xs={6} lg={3.5}>
          <Card elevation={0} sx={(theme) => cardSurface(theme, { compact: true })}>
            <Stack spacing={3}>
              <Stack spacing={1}>
                <Typography variant="h6">{t('home.readinessHeading')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('home.readinessDescription')}
                </Typography>
              </Stack>
              <Stack spacing={2}>
                <ReadinessRow icon={<CheckCircle2 size={18} aria-hidden />} text={t('home.readinessSecureMessages')} />
                <ReadinessRow icon={<ShieldCheck size={18} aria-hidden />} text={t('home.readinessSharePreferences')} />
                <ReadinessRow icon={<Sparkles size={18} aria-hidden />} text={t('home.readinessContactInfo')} />
              </Stack>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Stack spacing={0.5}>
            <Typography variant="h6">{t('home.clinicsHeading')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('home.clinicsDescription')}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('home.clinicCount', { count: clinics.length })}
          </Typography>
        </Stack>

        <Grid container spacing={3}>
          {clinics.map((clinic) => (
            <Grid item xs={12} md={6} key={clinic.id}>
              <Card
                component={MuiLink}
                href={{ pathname: '/[clinicId]', query: { clinicId: clinic.id } }}
                elevation={0}
                sx={(theme) => ({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  textDecoration: 'none',
                  borderRadius: 24,
                  border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.16)}`,
                  backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.75 : 0.96),
                  padding: theme.spacing(3),
                  transition: theme.transitions.create(['transform', 'box-shadow']),
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: '0 24px 40px rgba(13,148,136,0.25)',
                  },
                })}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    variant="rounded"
                    sx={(theme) => ({
                      width: 44,
                      height: 44,
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      color: theme.palette.primary.main,
                    })}
                  >
                    <Building2 size={20} aria-hidden />
                  </Avatar>
                  <Stack spacing={0.5}>
                    <Typography variant="overline" color="primary" fontWeight={600} sx={{ letterSpacing: 1.2 }}>
                      {t('actions.enterPortal')}
                    </Typography>
                    <Typography variant="h6">{clinic.name}</Typography>
                  </Stack>
                </Stack>
                {clinic.city ? (
                  <Typography variant="body2" color="text.secondary">
                    {clinic.city}
                  </Typography>
                ) : null}
                {clinic.specialties.length ? (
                  <Typography variant="caption" color="primary" fontWeight={600} sx={{ letterSpacing: 1 }}>
                    {clinic.specialties.join(' • ')}
                  </Typography>
                ) : null}
                <Box>
                  {clinic.bookingEnabled ? (
                    <Typography variant="body2" color="primary" fontWeight={600}>
                      {clinic.bookingPolicy.cancelWindowHours !== null
                        ? t('home.policyCancelWindow', { hours: clinic.bookingPolicy.cancelWindowHours })
                        : t('home.policyFlexible')}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="warning.main" fontWeight={600}>
                      {t('home.bookingPaused')}
                    </Typography>
                  )}
                  {clinic.bookingPolicy.noShowPolicyText ? (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {t('home.policyNoShow', { text: clinic.bookingPolicy.noShowPolicyText })}
                    </Typography>
                  ) : null}
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" color="primary.main" fontWeight={600}>
                  <Typography variant="body2" fontWeight={600}>
                    {t('actions.enterPortal')}
                  </Typography>
                  <ArrowRight size={16} aria-hidden />
                </Stack>
              </Card>
            </Grid>
          ))}
        </Grid>

        {clinics.length === 0 ? (
          <Card elevation={0} sx={(theme) => ({
            ...cardSurface(theme, { compact: true }),
            borderStyle: 'dashed',
            textAlign: 'center',
            color: theme.palette.primary.main,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
          })}
          >
            <Building2 size={28} aria-hidden />
            <Typography variant="body2">{t('home.clinicsEmpty')}</Typography>
          </Card>
        ) : null}
      </Stack>
    </Stack>
  );
}

type ReadinessRowProps = {
  icon: ReactNode;
  text: string;
};

function ReadinessRow({ icon, text }: ReadinessRowProps) {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="flex-start"
      sx={(theme) => ({
        borderRadius: 20,
        border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.2)}`,
        backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.12),
        padding: theme.spacing(2),
        color: theme.palette.text.primary,
      })}
    >
      <Avatar
        sx={(theme) => ({
          width: 36,
          height: 36,
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          color: theme.palette.primary.main,
        })}
      >
        {icon}
      </Avatar>
      <Typography variant="body2" sx={{ alignSelf: 'center' }}>
        {text}
      </Typography>
    </Stack>
  );
}
