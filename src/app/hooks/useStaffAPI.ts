import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useStaffAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = useCallback(async (url: string, options?: RequestInit) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        headers: { 'Content-Type': 'application/json' },
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
    });
  };

  const rejectCancellationRequest = (requestId: string, reason: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/cancel/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  };

  const approveRescheduleRequest = (requestId: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/reschedule/approve`, {
      method: 'PUT',
    });
  };

  const rejectRescheduleRequest = (requestId: string, reason: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/reschedule/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  };

  const verifyCoachingPayment = (requestId: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/coaching/verify`, {
      method: 'PUT',
    });
  };

  const rejectCoachingPayment = (requestId: string, reason: string) => {
    return handleRequest(`/api/staff/requests/${requestId}/coaching/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
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