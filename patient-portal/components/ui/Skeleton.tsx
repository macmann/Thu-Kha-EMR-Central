'use client';

import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

export function Skeleton({ className }: Props) {
  return <div className={cn('skeleton animate-shimmer rounded-md bg-surface-muted/60', className)} aria-hidden />;
}
