import React, { useEffect, useState } from 'react';

export function RemoteCursor({ x, y, color, userName }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [x, y]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        pointerEvents: 'none',
        zIndex: 9999,
        transition: 'transform 100ms linear',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill={color} stroke="white" strokeWidth="2">
        <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.42c.45 0 .67-.54.35-.85L5.5 3.21z" />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 10,
          background: color,
          color: '#0d0d1a',
          fontSize: 10,
          fontWeight: 'bold',
          padding: '2px 6px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        {userName}
      </div>
    </div>
  );
}
