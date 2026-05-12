import { useState } from 'react';
import { apiFetch } from '../utils/authenticatedFetch';

export const useAdminAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async (url: string, options?: RequestInit) => {
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
  };

  const getAnalytics = (dateRange: { start: string; end: string }) => {
    return handleRequest(`/api/admin/analytics?start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}`);
  };

  const getAllBookings = (filters?: any) => {
    const query = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return handleRequest(`/api/admin/bookings${query}`);
  };

  const getAllUsers = () => {
    return handleRequest(`/api/admin/users`);
  };

  const getUserBookingHistory = (userId: string) => {
    return handleRequest(`/api/admin/users/${userId}/bookings`);
  };

  const getPaymentTransactions = (filters?: any) => {
    const query = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return handleRequest(`/api/admin/payments${query}`);
  };

  const getLoyaltyProgram = () => {
    return handleRequest(`/api/admin/loyalty-program`);
  };

  const getOperationalStats = (date: string) => {
    return handleRequest(`/api/admin/operations/stats?date=${encodeURIComponent(date)}`);
  };

  return {
    getAnalytics,
    getAllBookings,
    getAllUsers,
    getUserBookingHistory,
    getPaymentTransactions,
    getLoyaltyProgram,
    getOperationalStats,
    loading,
    error
  };
};