import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/apiClient';
import Button from '@/components/Button';
import Card from '@/components/Card';

interface PendingRequest {
  id: string;
  tenant_id: string;
  owner_email: string;
  monthly_fee: number;
  requested_at: string;
  status: string;
  notes?: string | null;
}

export function AdminSubscriptionManager() {
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await apiGet<PendingRequest[]>('/api/subscriptions/pending');
      setPendingRequests(result.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pending requests';
      setError(errorMessage);
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const handleApprove = async (subscriptionId: string) => {
    setActionInProgress(subscriptionId);
    try {
      await apiPost('/api/subscriptions/approve', {
        subscription_id: subscriptionId,
        notes: 'Approved by admin',
      });

      alert('Subscription approved successfully');
      await fetchPendingRequests();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error approving subscription');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (subscriptionId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    setActionInProgress(subscriptionId);
    try {
      await apiPost('/api/subscriptions/reject', {
        subscription_id: subscriptionId,
        rejection_reason: reason,
      });

      alert('Subscription rejected');
      await fetchPendingRequests();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error rejecting subscription');
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <p className="text-gray-500">Loading pending requests...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <p className="text-red-800">{error}</p>
      </Card>
    );
  }

  if (pendingRequests.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-gray-500 text-center">No pending subscription requests</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Pending Subscription Requests</h3>

      <div className="space-y-4">
        {pendingRequests.map((request) => (
          <div
            key={request.id}
            className="border border-gray-200 rounded-lg p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{request.owner_email}</p>
                <p className="text-sm text-gray-600">
                  Requested: {new Date(request.requested_at).toLocaleDateString()}
                </p>
              </div>
              <span className="text-sm font-semibold text-green-600">
                ${request.monthly_fee}/month
              </span>
            </div>

            {request.notes ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Payment details</p>
                <p className="whitespace-pre-wrap">{request.notes}</p>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button
                onClick={() => handleApprove(request.id)}
                disabled={actionInProgress !== null}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2"
              >
                {actionInProgress === request.id ? 'Processing...' : 'Approve'}
              </Button>
              <Button
                onClick={() => handleReject(request.id)}
                disabled={actionInProgress !== null}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2"
              >
                {actionInProgress === request.id ? 'Processing...' : 'Reject'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
