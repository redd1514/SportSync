import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

  const getFacilityInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/facilities`);
      if (!response.ok) throw new Error('Failed to fetch facility info');
      return await response.json();
    } catch (err) {
      console.error('Error fetching facility info:', err);
      return {
        name: 'JRC Sports Complex',
        address: 'Valenzuela City, Metro Manila',
        hours: '7:00 AM - 12:00 MN',
        phone: '+63 (2) 1234-5678',
      };
    }
  };

  const getCourtStatuses = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/facilities/courts/status`);
      if (!response.ok) throw new Error('Failed to fetch court statuses');
      return await response.json();
    } catch (err) {
      console.error('Error fetching court statuses:', err);
      return [
        { id: 'basketball1', name: 'Basketball 1', status: 'available', sport: 'Basketball' },
        { id: 'basketball2', name: 'Basketball 2', status: 'available', sport: 'Basketball' },
        { id: 'volleyball1', name: 'Volleyball 1', status: 'available', sport: 'Volleyball' },
        { id: 'badminton1', name: 'Badminton 1', status: 'available', sport: 'Badminton' },
        { id: 'pickleball1', name: 'Pickleball 1', status: 'occupied', sport: 'Pickleball' },
      ];
    }
  };

  return {
    getFacilityMap,
    getCourtDetails,
    getAvailableCourts,
    getCourtBookings,
    updateFacilityLayout,
    addCourt,
    updateCourtStatus,
    getFacilityInfo,
    getCourtStatuses,
    loading,
    error
  };
};