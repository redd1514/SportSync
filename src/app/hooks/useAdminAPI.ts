import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/authenticatedFetch';

export const useAdminAPI = () => {
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

  const getAnalytics = useCallback((dateRange: { start: string; end: string }) => {
    return handleRequest(`/api/admin/analytics?start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}`);
  }, [handleRequest]);

  const getAllBookings = useCallback((filters?: any) => {
    const query = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return handleRequest(`/api/admin/bookings${query}`);
  }, [handleRequest]);

  const getAllUsers = useCallback(() => {
    return handleRequest(`/api/admin/users`);
  }, [handleRequest]);

  const updateUser = useCallback((userId: string, updates: Record<string, unknown>) => {
    return handleRequest(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }, [handleRequest]);

  const getUserBookingHistory = useCallback((userId: string) => {
    return handleRequest(`/api/admin/users/${userId}/bookings`);
  }, [handleRequest]);

  const getPaymentTransactions = useCallback((filters?: any) => {
    const query = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return handleRequest(`/api/admin/payments${query}`);
  }, [handleRequest]);

  const getLoyaltyProgram = useCallback(() => {
    return handleRequest(`/api/admin/loyalty-program`);
  }, [handleRequest]);

  const getOperationalStats = useCallback((date: string) => {
    return handleRequest(`/api/admin/operations/stats?date=${encodeURIComponent(date)}`);
  }, [handleRequest]);

  return {
    getAnalytics,
    getAllBookings,
    getAllUsers,
    updateUser,
    getUserBookingHistory,
    getPaymentTransactions,
    getLoyaltyProgram,
    getOperationalStats,
    loading,
    error
  };
};