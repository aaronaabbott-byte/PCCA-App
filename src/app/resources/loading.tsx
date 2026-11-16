import { ShellSkeleton } from '@/components/ShellSkeleton';

// Next renders this the instant a navigation starts and keeps it on screen
// until the server component resolves. One file per dynamic route.

export default function Loading() {
  return <ShellSkeleton />;
}
