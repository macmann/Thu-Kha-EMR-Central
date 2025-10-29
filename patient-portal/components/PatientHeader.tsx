import NextLink from 'next/link';
import { AppBar, Avatar, Box, Link as MuiLink, Stack, Typography } from '@mui/material';

type PatientHeaderProps = {
  clinicName: string;
  logoUrl?: string | null;
};

export function PatientHeader({ clinicName, logoUrl }: PatientHeaderProps) {
  const initial = clinicName.at(0)?.toUpperCase() ?? 'C';

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        background: 'linear-gradient(120deg, rgba(20,184,166,0.92), rgba(14,116,144,0.92))',
        backdropFilter: 'blur(4px)',
        color: 'common.white',
      }}
    >
      <Stack direction="row" justifyContent="center" sx={{ px: { xs: 2, sm: 4 }, py: 2.5 }}>
        <Box maxWidth={720} width="100%">
          <MuiLink
            component={NextLink}
            href="/"
            underline="none"
            sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'inherit' }}
          >
            {logoUrl ? (
              <Avatar
                src={logoUrl}
                alt={`${clinicName} logo`}
                sx={{ width: 48, height: 48, border: '2px solid rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.2)' }}
                imgProps={{ width: 48, height: 48, style: { objectFit: 'cover' } }}
              />
            ) : (
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  border: '2px solid rgba(255,255,255,0.6)',
                  bgcolor: 'rgba(255,255,255,0.2)',
                  fontWeight: 600,
                }}
              >
                {initial}
              </Avatar>
            )}
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.8, letterSpacing: 2, textTransform: 'uppercase' }}>
                Patient Portal
              </Typography>
              <Typography variant="h6" component="p" sx={{ fontWeight: 600 }}>
                {clinicName}
              </Typography>
            </Box>
          </MuiLink>
        </Box>
      </Stack>
    </AppBar>
  );
}
