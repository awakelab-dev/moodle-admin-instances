import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
