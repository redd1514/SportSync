import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/authenticatedFetch';

export const useStaffAPI = () => {
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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg =
          typeof (payload as { error?: string })?.error === 'string'
            ? (payload as { error: string }).error
            : `Request failed (${response.status})`;
        throw new Error(msg);
      }
      return payload;
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

  const getPendingRequests = useCallback(() => {
    return handleRequest(`/api/staff/requests/pending`);
  }, [handleRequest]);

  const approveCancellationRequest = useCallback((requestId: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/cancel/approve`, {
      method: 'PUT',
    });
  }, [handleRequest]);

  const rejectCancellationRequest = useCallback((requestId: string, reason: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/cancel/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }, [handleRequest]);

  const approveRescheduleRequest = useCallback((requestId: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/reschedule/approve`, {
      method: 'PUT',
    });
  }, [handleRequest]);

  const rejectRescheduleRequest = useCallback((requestId: string, reason: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/reschedule/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }, [handleRequest]);

  const verifyCoachingPayment = useCallback((requestId: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/coaching/verify`, {
      method: 'PUT',
    });
  }, [handleRequest]);

  const rejectCoachingPayment = useCallback((requestId: string, reason: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/coaching/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }, [handleRequest]);

  const getStaffAccounts = useCallback(() => {
    return handleRequest(`/api/admin/staff`);
  }, [handleRequest]);

  const createStaffAccount = useCallback((data: unknown) => {
    return handleRequest(`/api/admin/staff`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }, [handleRequest]);

  const updateStaffAccount = useCallback((staffId: string, updates: unknown) => {
    return handleRequest(`/api/admin/staff/${staffId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }, [handleRequest]);

  const deactivateStaffAccount = useCallback((staffId: string) => {
    return handleRequest(`/api/admin/staff/${staffId}/deactivate`, {
      method: 'PUT',
    });
  }, [handleRequest]);

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