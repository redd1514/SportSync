import { useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';

export const usePaymentAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async (url: string, options?: RequestInit) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}${url}`, {
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
  };

  const createPayment = (bookingId: string, amount: number, method: string) => {
    return handleRequest(`/api/payments`, {
      method: 'POST',
      body: JSON.stringify({ bookingId, amount, method }),
    });
  };

  const getPaymentStatus = (paymentId: string) => {
    return handleRequest(`/api/payments/${paymentId}/status`);
  };

  const getUserPayments = (userId: string) => {
    return handleRequest(`/api/users/${userId}/payments`);
  };

  const processRefund = (paymentId: string) => {
    return handleRequest(`/api/payments/${paymentId}/refund`, {
      method: 'POST',
    });
  };

  return {
    createPayment,
    getPaymentStatus,
    getUserPayments,
    processRefund,
    loading,
    error
  };
};