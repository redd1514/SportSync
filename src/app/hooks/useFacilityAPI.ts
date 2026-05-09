import { useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const useFacilityAPI = () => {
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

  const getFacilityMap = () => {
    return handleRequest(`/api/facilities/map`);
  };

  const getCourtDetails = (courtId: string) => {
    return handleRequest(`/api/facilities/courts/${courtId}`);
  };

  const getAvailableCourts = (date: string, sport: string) => {
    return handleRequest(`/api/facilities/courts/available?date=${encodeURIComponent(date)}&sport=${encodeURIComponent(sport)}`);
  };

  const getCourtBookings = (courtId: string, date: string) => {
    return handleRequest(`/api/facilities/courts/${courtId}/bookings?date=${encodeURIComponent(date)}`);
  };

  const updateFacilityLayout = (layoutData: any) => {
    return handleRequest(`/api/facilities/map`, {
      method: 'PUT',
      body: JSON.stringify(layoutData),
    });
  };

  const addCourt = (courtData: any) => {
    return handleRequest(`/api/facilities/courts`, {
      method: 'POST',
      body: JSON.stringify(courtData),
    });
  };

  const updateCourtStatus = (courtId: string, status: string) => {
    return handleRequest(`/api/facilities/courts/${courtId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  };

  return {
    getFacilityMap,
    getCourtDetails,
    getAvailableCourts,
    getCourtBookings,
    updateFacilityLayout,
    addCourt,
    updateCourtStatus,
    loading,
    error
  };
};