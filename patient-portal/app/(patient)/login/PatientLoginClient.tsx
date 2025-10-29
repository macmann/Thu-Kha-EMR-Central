'use client';

import { useEffect, useState, type ReactNode } from 'react';
import NextLink from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

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

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: (theme) => theme.palette.background.default,
        py: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="stretch">
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: '100%',
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                color: 'common.white',
                display: 'flex',
              }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Typography variant="overline" sx={{ letterSpacing: 2, opacity: 0.9 }}>
                  Thu Kha EMR
                </Typography>
                <Typography variant="h4" component="h2" fontWeight={700}>
                  Welcome back to your patient portal
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Manage appointments, review test results, and stay connected with your care team anywhere in Myanmar.
                </Typography>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                <Stack spacing={2}>
                  <FeatureItem>Secure one-time passcode login keeps your information safe.</FeatureItem>
                  <FeatureItem>Check visit summaries, invoices, and upcoming appointments.</FeatureItem>
                  <FeatureItem>Receive timely notifications from your clinic team.</FeatureItem>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card elevation={8} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardHeader
                title={<Typography variant="h4">Patient Login</Typography>}
                subheader={
                  <Typography variant="body2" color="text.secondary">
                    Enter the phone number from your Primary Contact to receive a one-time passcode.
                  </Typography>
                }
              />
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
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

type FeatureItemProps = { children: ReactNode };

function FeatureItem({ children }: FeatureItemProps) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
        }}
      >
        ✓
      </Box>
      <Typography variant="body2" sx={{ opacity: 0.95 }}>
        {children}
      </Typography>
    </Stack>
  );
}
