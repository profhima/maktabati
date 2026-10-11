import React from 'react';
import { useApp } from '../context/AppContext';

export const Toast: React.FC = () => {
  const { toastMessage } = useApp();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-5 left-5 z-[9999] bg-[#1F2A3C] text-[#F6F1E7] px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition-all duration-300 transform translate-y-0 border border-[#A9762F]/30 animate-in fade-in slide-in-from-bottom-2">
      {toastMessage}
    </div>
  );
};
