import React from 'react';

// Props: userName, color, isTyping
export function AttributionLabel({ userName, color, isTyping }) {
  return (
    <div style={{
      position: 'absolute',
      top: -24,
      left: 0,
      background: color,
      color: '#0d0d1a',
      fontSize: 10,
      fontWeight: 700,
      fontFamily: 'Inter, sans-serif',
      padding: '2px 6px',
      borderRadius: 4,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      userSelect: 'none',
      boxShadow: isTyping ? `0 0 6px ${color}99` : 'none',
      transition: 'box-shadow 200ms ease',
      zIndex: 10,
    }}>
      {userName}{isTyping ? ' ✍️' : ''}
    </div>
  );
}
