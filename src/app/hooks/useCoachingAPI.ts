import { useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';

export const useCoachingAPI = () => {
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

  const getCoaches = (sportFilter?: string) => {
    const query = sportFilter ? `?sport=${encodeURIComponent(sportFilter)}` : '';
    return handleRequest(`/api/coaches${query}`);
  };

  const getCoachDetails = (coachId: string) => {
    return handleRequest(`/api/coaches/${coachId}`);
  };

  const requestCoachingSession = (data: any) => {
    return handleRequest(`/api/coaches/sessions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  const getUserCoachingSessions = (userId: string) => {
    return handleRequest(`/api/users/${userId}/coaching-sessions`);
  };

  const approveCoachingSession = (sessionId: string) => {
    return handleRequest(`/api/coaches/sessions/${sessionId}/approve`, {
      method: 'PUT',
    });
  };

  const rejectCoachingSession = (sessionId: string, reason: string) => {
    return handleRequest(`/api/coaches/sessions/${sessionId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  };

  const cancelCoachingSession = (sessionId: string) => {
    return handleRequest(`/api/coaches/sessions/${sessionId}/cancel`, {
      method: 'PUT',
    });
  };

  const rescheduleCoachingSession = (sessionId: string, newDate: string, newTime: string) => {
    return handleRequest(`/api/coaches/sessions/${sessionId}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify({ requestedDate: newDate, requestedTime: newTime }),
    });
  };

  const getCoachAvailability = (coachId: string) => {
    return handleRequest(`/api/coaches/${coachId}/availability`);
  };

  return {
    getCoaches,
    getCoachDetails,
    requestCoachingSession,
    getUserCoachingSessions,
    approveCoachingSession,
    rejectCoachingSession,
    cancelCoachingSession,
    rescheduleCoachingSession,
    getCoachAvailability,
    loading,
    error
  };
};