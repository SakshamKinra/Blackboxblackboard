// src/components/Countdown.jsx
import React, { useState, useEffect } from 'react';

export default function Countdown({ unlockAt, serverTime }) {
  // offset is positive if client clock is AHEAD of server clock
  const [offset] = useState(serverTime ? Date.now() - serverTime : 0);
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(unlockAt, offset));

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(unlockAt, offset)), 1000);
    return () => clearInterval(timer);
  }, [unlockAt, offset]);

  function getTimeLeft(target, currentOffset) {
    const adjustedNow = Date.now() - currentOffset;
    const diff = new Date(target).getTime() - adjustedNow;
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
          className="flex flex-col items-center rounded-xl px-4 py-3 min-w-[64px] shadow-lg border"
          style={{ backgroundColor: 'var(--countdown-bg)', borderColor: 'var(--countdown-border)' }}
        >
          <span className="text-3xl font-extrabold text-[#C9A84C] tabular-nums">
            {String(value).padStart(2, '0')}
          </span>
          <span className="text-xs uppercase tracking-widest mt-1" style={{ color: 'var(--muted)' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
