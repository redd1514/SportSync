import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/authenticatedFetch';
import { useUser } from '../contexts/UserContext';

export const useStaffAPI = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = useCallback(async (url: string, options?: RequestInit) => {
    setLoading(true);
    setError(null);
    try {
      const path = url.startsWith('/api') ? url : `/api${url.startsWith('/') ? url : `/${url}`}`;
      const response = await apiFetch(path, {
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        ...options,
      });
      if (!response.ok) throw new Error(`Request failed: ${response.statusText}`);
      return await response.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getStaffOperations = useCallback(
    (date: string) => handleRequest(`/api/staff/operations?date=${encodeURIComponent(date)}`),
    [handleRequest]
  );

  const getPendingRequests = () => {
    return handleRequest(`/api/staff/requests/pending`);
  };

  const approveCancellationRequest = (requestId: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/cancel/approve`, {
      method: 'PUT',
      body: JSON.stringify({ staff_id: user?.id }),
    });
  };

  const rejectCancellationRequest = (requestId: string, reason: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/cancel/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason, staff_id: user?.id }),
    });
  };

  const approveRescheduleRequest = (requestId: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/reschedule/approve`, {
      method: 'PUT',
      body: JSON.stringify({ staff_id: user?.id }),
    });
  };

  const rejectRescheduleRequest = (requestId: string, reason: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/reschedule/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason, staff_id: user?.id }),
    });
  };

  const verifyCoachingPayment = (requestId: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/coaching/verify`, {
      method: 'PUT',
      body: JSON.stringify({ staff_id: user?.id }),
    });
  };

  const rejectCoachingPayment = (requestId: string, reason: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/coaching/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason, staff_id: user?.id }),
    });
  };

  const getStaffAccounts = () => {
    return handleRequest(`/api/admin/staff`);
  };

  const createStaffAccount = (data: any) => {
    return handleRequest(`/api/admin/staff`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  const updateStaffAccount = (staffId: string, updates: any) => {
    return handleRequest(`/api/admin/staff/${staffId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  };

  const deactivateStaffAccount = (staffId: string) => {
    return handleRequest(`/api/admin/staff/${staffId}/deactivate`, {
      method: 'PUT',
    });
  };

  return {
    getStaffOperations,
    getPendingRequests,
    approveCancellationRequest,
    rejectCancellationRequest,
    approveRescheduleRequest,
    rejectRescheduleRequest,
    verifyCoachingPayment,
    rejectCoachingPayment,
    getStaffAccounts,
    createStaffAccount,
    updateStaffAccount,
    deactivateStaffAccount,
    loading,
    error
  };
};
