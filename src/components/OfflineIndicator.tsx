import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="no-print bg-amber-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2"
      role="status"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Offline — Changes are saved locally and will sync automatically when online.</span>
    </div>
  );
};
