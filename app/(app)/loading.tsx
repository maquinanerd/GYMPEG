'use client';

import { usePathname } from 'next/navigation';
import { HomeSkeleton, ScreenSkeleton } from '@/components/home/home-skeleton';

// Loading state of the signed-in app. This file wraps every screen of the
// (app) group, so only the home gets its own shapes; a screen without a
// loading.tsx of its own falls back to a neutral title-and-rows skeleton.
export default function AppLoading() {
  const pathname = usePathname();
  return pathname === '/' ? <HomeSkeleton /> : <ScreenSkeleton />;
}
