// src/components/Countdown.jsx
import React, { useState, useEffect } from 'react';

export default function Countdown({ unlockAt }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(unlockAt));

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(unlockAt)), 1000);
    return () => clearInterval(timer);
  }, [unlockAt]);

  function getTimeLeft(target) {
    const diff = new Date(target) - new Date();
    if (diff <= 0) return null;
    return {
      days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }

  if (!timeLeft) {
    return (
      <p className="text-[#1D9E75] font-semibold animate-pulse text-center">
        🔓 Time lock expired — ready to unlock!
      </p>
    );
  }

  const units = [
    { label: 'Days',    value: timeLeft.days },
    { label: 'Hours',   value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ];

  return (
    <div className="flex gap-3 justify-center flex-wrap">
      {units.map(({ label, value }) => (
        <div
          key={label}
          className="bb-card flex flex-col items-center rounded-xl px-4 py-3 min-w-[64px]
                     border border-[#C9A84C]/20 shadow-lg"
        >
          <span className="text-3xl font-extrabold text-[#C9A84C] tabular-nums">
            {String(value).padStart(2, '0')}
          </span>
          <span className="text-xs bb-muted uppercase tracking-widest mt-1">{label}</span>
        </div>
      ))}
    </div>
  );
}
