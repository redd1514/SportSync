import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  isLoading?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Real-time connection status indicator
 * Shows connected/disconnected/loading state with visual feedback
 */
export function ConnectionStatus({
  isConnected,
  isLoading = false,
  showLabel = true,
  size = 'md',
  className = '',
}: ConnectionStatusProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  if (isLoading) {
    return (
      <div
        className={`flex items-center rounded-full bg-blue-500/10 border border-blue-500/30 ${sizeClasses[size]} ${className}`}
      >
        <Loader2 size={iconSizes[size]} className="text-blue-500 animate-spin" />
        {showLabel && <span className="text-blue-500 font-medium">Connecting...</span>}
      </div>
    );
  }

  if (isConnected) {
    return (
      <div
        className={`flex items-center rounded-full bg-green-500/10 border border-green-500/30 ${sizeClasses[size]} ${className}`}
      >
        <Wifi size={iconSizes[size]} className="text-green-500 animate-pulse" />
        {showLabel && <span className="text-green-500 font-medium">Live</span>}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center rounded-full bg-red-500/10 border border-red-500/30 ${sizeClasses[size]} ${className}`}
    >
      <WifiOff size={iconSizes[size]} className="text-red-500" />
      {showLabel && <span className="text-red-500 font-medium">Offline</span>}
    </div>
  );
}

/**
 * Inline connection status badge - minimal version for headers
 */
export function ConnectionStatusBadge({ isConnected, isLoading = false }: { isConnected: boolean; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1 text-xs text-blue-500">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        Connecting
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      {isConnected ? 'Live' : 'Offline'}
    </div>
  );
}
