import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useAddonsAPI = () => {
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

  const getAddons = () => {
    return handleRequest(`/api/addons`);
  };

  const createAddon = (data: any) => {
    return handleRequest(`/api/addons`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  const updateAddon = (addonId: string, updates: any) => {
    return handleRequest(`/api/addons/${addonId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  };

  const deleteAddon = (addonId: string) => {
    return handleRequest(`/api/addons/${addonId}`, {
      method: 'DELETE',
    });
  };

  const getCourtAddons = (courtId: string) => {
    return handleRequest(`/api/facilities/courts/${courtId}/addons`);
  };

  return {
    getAddons,
    createAddon,
    updateAddon,
    deleteAddon,
    getCourtAddons,
    loading,
    error
  };
};