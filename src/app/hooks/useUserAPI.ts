import { useState } from 'react';
import { apiFetch } from '../utils/authenticatedFetch';

export const useUserAPI = () => {
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

  const getUserProfile = (userId: string) => {
    return handleRequest(`/api/users/${userId}`);
  };

  const updateUserProfile = (userId: string, updates: any) => {
    return handleRequest(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  };

  const getUserLoyaltyPoints = (userId: string) => {
    return handleRequest(`/api/users/${userId}/loyalty`);
  };

  const redeemLoyaltyPoints = (userId: string, points: number) => {
    return handleRequest(`/api/users/${userId}/loyalty/redeem`, {
      method: 'POST',
      body: JSON.stringify({ points }),
    });
  };

  const resetLoyaltyPoints = (userId: string) => {
    return handleRequest(`/api/users/${userId}/loyalty/reset`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  };

  const addTestLoyaltyPoint = (userId: string) => {
    return handleRequest(`/api/users/${userId}/loyalty/add-test`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  };

  return {
    getUserProfile,
    updateUserProfile,
    getUserLoyaltyPoints,
    redeemLoyaltyPoints,
    resetLoyaltyPoints,
    addTestLoyaltyPoint,
    loading,
    error
  };
};
