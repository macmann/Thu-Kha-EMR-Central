'use client';

import { useEffect, useState, type ReactNode } from 'react';
import NextLink from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ScienceIcon from '@mui/icons-material/Science';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ForumIcon from '@mui/icons-material/Forum';

type Step = 'start' | 'verify' | 'success';

type Props = {
  staffPortalUrl: string;
  isExternalStaffPortalUrl: boolean;
};

interface FormError {
  message: string;
}

export function PatientLoginClient({ staffPortalUrl, isExternalStaffPortalUrl }: Props) {
  const router = useRouter();
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('start');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    router.prefetch('/');
  }, [router]);

  useEffect(() => {
    if (step !== 'success') {
      return;
    }

    const redirectTimer = setTimeout(() => {
      router.replace('/');
    }, 800);

    return () => {
      clearTimeout(redirectTimer);
    };
  }, [router, step]);

  const StaffPortalLink = ({ children }: { children: ReactNode }) => {
    if (isExternalStaffPortalUrl) {
      return (
        <Typography component="a" href={staffPortalUrl} target="_blank" rel="noreferrer" color="primary" fontWeight={600}>
          {children}
        </Typography>
      );
    }

    return (
      <Typography component={NextLink} href={staffPortalUrl as Route} color="primary" fontWeight={600}>
        {children}
      </Typography>
    );
  };

  const handleStart = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatusMessage('');

    try {
      const trimmedContact = contact.trim();
      if (!trimmedContact) {
        throw new Error('Please enter the phone number listed as your Primary Contact.');
      }

      if (trimmedContact !== contact) {
        setContact(trimmedContact);
      }

      const response = await fetch('/api/patient/auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneOrEmail: trimmedContact }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Unable to send OTP. Confirm your Primary Contact number in the EMR.');
      }

      setStep('verify');
      setStatusMessage('OTP sent! Please check your messages.');
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Unable to send OTP.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatusMessage('');

    try {
      const response = await fetch('/api/patient/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneOrEmail: contact, otp }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Unable to verify OTP.');
      }

      setStep('success');
      setStatusMessage('Login successful! Redirecting to your dashboard…');
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Unable to verify OTP.' });
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Verify contact', 'Enter passcode', 'Access portal'];
  const activeStepIndex = step === 'start' ? 0 : step === 'verify' ? 1 : 2;

  const featureCards: FeatureCardProps[] = [
    {
      icon: <CalendarMonthIcon fontSize="small" />,
      title: 'Appointments',
      description: 'View, confirm, and receive reminders for upcoming visits.',
    },
    {
      icon: <ScienceIcon fontSize="small" />,
      title: 'Lab results',
      description: 'Track your diagnostics history with translated explanations.',
    },
    {
      icon: <ReceiptLongIcon fontSize="small" />,
      title: 'Billing',
      description: 'Download invoices and review payment status in seconds.',
    },
    {
      icon: <ForumIcon fontSize="small" />,
      title: 'Care messages',
      description: 'Stay in touch with your care team for follow-up questions.',
    },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'stretch',
        bgcolor: (theme) => theme.palette.background.paper,
        backgroundImage: (theme) =>
          `radial-gradient(circle at top left, ${theme.palette.primary.light}1f, transparent 55%), ` +
          `linear-gradient(180deg, ${theme.palette.background.default}, ${theme.palette.background.paper})`,
        py: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="stretch">
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3} sx={{ height: '100%' }}>
              <Card
                sx={{
                  p: { xs: 3, md: 4 },
                  background: (theme) =>
                    `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  color: 'common.white',
                  borderRadius: 4,
                  boxShadow: '0 20px 60px rgba(23, 43, 77, 0.35)',
                }}
              >
                <Stack spacing={2.5}>
                  <Typography variant="overline" sx={{ letterSpacing: 2, opacity: 0.8 }}>
                    Thu Kha EMR
                  </Typography>
                  <Typography variant="h4" component="h2" fontWeight={700}>
                    Your care, available anywhere
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    Manage your health in one secure place with real-time updates from your clinic team.
                  </Typography>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.25)' }} />
                  <Stack spacing={2}>
                    <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                      What you can do in the portal
                    </Typography>
                    <Grid container spacing={2}>
                      {featureCards.map((feature) => (
                        <Grid size={{ xs: 12, sm: 6 }} key={feature.title}>
                          <FeatureCard {...feature} />
                        </Grid>
                      ))}
                    </Grid>
                  </Stack>
                </Stack>
              </Card>
              <Card sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
                <Stack spacing={1.5}>
                  <Typography variant="h6">Connected care without the wait</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Receive instant notifications and reminders once you sign in with your Primary Contact number.
                  </Typography>
                </Stack>
              </Card>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              elevation={12}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 4,
                backdropFilter: 'blur(8px)',
              }}
            >
              <CardHeader
                title={<Typography variant="h4">Patient Login</Typography>}
                subheader={
                  <Typography variant="body2" color="text.secondary">
                    Enter the phone number from your Primary Contact to receive a one-time passcode.
                  </Typography>
                }
              />
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Stepper
                  activeStep={activeStepIndex}
                  alternativeLabel
                  sx={{
                    '& .MuiStepConnector-line': { borderColor: 'divider' },
                    '& .MuiStepLabel-label': { typography: 'caption' },
                  }}
                >
                  {steps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>

                <Typography variant="body2" color="text.secondary">
                  သင်၏ Primary Contact တွင် ဖော်ပြထားသော ဖုန်းနံပါတ်ကို ထည့်ပါ၊ OTP ကုဒ်တစ်ခုကို လက်ခံရရှိပါမည်။
                </Typography>

                {error ? <Alert severity="error">{error.message}</Alert> : null}
                {statusMessage ? <Alert severity="success">{statusMessage}</Alert> : null}

                {step === 'start' ? (
                  <Box component="form" onSubmit={handleStart} noValidate>
                    <Stack spacing={2.5}>
                      <TextField
                        id="contact"
                        label="Primary Contact phone number"
                        placeholder="09..."
                        fullWidth
                        value={contact}
                        onChange={(event) => setContact(event.target.value)}
                        autoComplete="tel"
                        autoFocus
                      />
                      <Button type="submit" disabled={loading} size="large">
                        {loading ? <CircularProgress size={20} color="inherit" /> : 'Send one-time passcode'}
                      </Button>
                    </Stack>
                  </Box>
                ) : null}

                {step === 'verify' ? (
                  <Box component="form" onSubmit={handleVerify} noValidate>
                    <Stack spacing={2.5}>
                      <TextField
                        id="otp"
                        label="One-time passcode"
                        placeholder="Enter the 6-digit code"
                        fullWidth
                        value={otp}
                        onChange={(event) => setOtp(event.target.value)}
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
                      />
                      <Button type="submit" disabled={loading} size="large">
                        {loading ? <CircularProgress size={20} color="inherit" /> : 'Verify and sign in'}
                      </Button>
                    </Stack>
                  </Box>
                ) : null}

                {step === 'success' ? (
                  <Alert severity="success">{statusMessage}</Alert>
                ) : null}

                <Stack spacing={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    Need help from the clinic team? Visit the staff portal at{' '}
                    <StaffPortalLink>{staffPortalUrl}</StaffPortalLink>.
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    By signing in, you agree to receive notifications about your care via SMS or email.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 3,
        px: 2.5,
        py: 2,
        backgroundColor: 'rgba(255,255,255,0.14)',
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(255,255,255,0.25)',
        color: 'common.white',
      }}
      elevation={0}
    >
      <Stack spacing={1.5}>
        <Avatar
          sx={{
            bgcolor: 'rgba(255,255,255,0.25)',
            width: 36,
            height: 36,
          }}
          variant="rounded"
        >
          {icon}
        </Avatar>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            {description}
          </Typography>
        </Stack>
      </Stack>
    </Card>
  );
}
