import React, { useState } from 'react';
import { apiGet } from '@/lib/apiClient';
import { SubscriptionStatus } from '@/components/SubscriptionStatus';
import { AdminSubscriptionManager } from '@/components/AdminSubscriptionManager';
import Card from '@/components/Card';

/**
 * Subscription Settings Page
 * 
 * This page shows:
 * - For Owners: Their current subscription status and ability to request
 * - For Admins: A dashboard to manage pending requests
 * 
 * Add this to your app/subscriptions/page.tsx or app/settings/subscriptions.tsx
 */
export function SubscriptionSettings() {
  const [userRole, setUserRole] = useState<'owner' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const result = await apiGet<{ role: string; is_admin?: boolean }>('/api/tenant-role');
        if (result.data?.is_admin) {
          setUserRole('admin');
        } else if (result.data?.role === 'owner') {
          setUserRole('owner');
        } else {
          setUserRole(null);
        }
      } catch (err) {
        console.error('Failed to fetch user role:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Subscription Management</h1>
        <p className="text-gray-600">
          Manage your subscription to access inventory features
        </p>
      </div>

      {userRole === 'owner' && (
        <div className="space-y-4">
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">📋 How It Works</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✓ Request a subscription for $5/month</li>
              <li>✓ Our admin team will review and approve your request</li>
              <li>✓ Once approved, you'll have access to all inventory features</li>
              <li>✓ Your subscription will auto-renew monthly</li>
            </ul>
          </Card>
          <SubscriptionStatus />
        </div>
      )}

      {userRole === 'admin' && (
        <div className="space-y-4">
          <Card className="p-6 bg-purple-50 border-purple-200">
            <h3 className="font-semibold text-purple-900 mb-2">🔧 Admin Dashboard</h3>
            <p className="text-sm text-purple-800">
              Review and approve/reject pending subscription requests from owners
            </p>
          </Card>
          <AdminSubscriptionManager />
        </div>
      )}

      {!userRole && (
        <Card className="p-6 border-yellow-200 bg-yellow-50">
          <p className="text-yellow-800">You can view subscription status in the main app. Only the tenant owner can request a subscription and only an admin can approve requests.</p>
        </Card>
      )}
    </div>
  );
}

export default SubscriptionSettings;
