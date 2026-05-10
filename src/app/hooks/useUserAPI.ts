import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useUserAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async (url: string, options?: RequestInit) => {
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

  return {
    getUserProfile,
    updateUserProfile,
    getUserLoyaltyPoints,
    redeemLoyaltyPoints,
    loading,
    error
  };
};