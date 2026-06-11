import React from 'react';

export function SkeletonCard() {
  return (
    <div className="bb-card border border-[#C9A84C]/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
      <div className="absolute inset-0 z-0 animate-shimmer pointer-events-none" />
      <div className="relative z-10 flex justify-between items-start mb-6">
        <div>
          <div className="h-6 w-32 bg-gray-500/20 rounded-md mb-2"></div>
          <div className="h-4 w-24 bg-gray-500/20 rounded-md"></div>
        </div>
        <div className="h-8 w-8 bg-gray-500/20 rounded-full"></div>
      </div>
      <div className="relative z-10 flex items-center justify-between">
        <div className="h-4 w-20 bg-gray-500/20 rounded-md"></div>
        <div className="h-6 w-16 bg-gray-500/20 rounded-full"></div>
      </div>
    </div>
  );
}
