'use client';

import { useState } from 'react';
import {
  AccountCircleRounded,
  AssignmentRounded,
  EventAvailableRounded,
  HomeRounded,
  MedicationRounded,
  ScienceRounded,
} from '@mui/icons-material';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

const navItems: NavItem[] = [
  { href: '#home', label: 'Home', icon: HomeRounded },
  { href: '#visits', label: 'Visits', icon: AssignmentRounded },
  { href: '#labs', label: 'Labs', icon: ScienceRounded },
  { href: '#meds', label: 'Meds', icon: MedicationRounded },
  { href: '#appointments', label: 'Appointments', icon: EventAvailableRounded },
  { href: '#profile', label: 'Profile', icon: AccountCircleRounded },
];

export function PatientNav() {
  const [value, setValue] = useState(0);

  return (
    <Paper
      component="nav"
      elevation={8}
      sx={{ position: 'sticky', bottom: 0, left: 0, right: 0, borderRadius: 0, backdropFilter: 'blur(8px)' }}
    >
      <BottomNavigation
        showLabels
        value={value}
        onChange={(_, nextValue) => setValue(nextValue)}
        sx={{ justifyContent: 'space-around', backgroundColor: (theme) => theme.palette.background.paper }}
      >
        {navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <BottomNavigationAction
              key={item.href}
              label={item.label}
              icon={<Icon fontSize="small" />}
              href={item.href}
              component="a"
              value={index}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}
