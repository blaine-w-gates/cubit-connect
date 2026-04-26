/**
 * Status Page Route
 *
 * Next.js App Router route for the sync status page.
 * Accessible at /status
 *
 * @module status/page
 * @production
 */

import { StatusPage } from '@/components/StatusPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cubit Connect - Sync Status',
  description: 'Real-time synchronization health status',
};

export default function StatusRoute() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <StatusPage />
    </main>
  );
}
