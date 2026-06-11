import React from 'react';

export function AvatarBar({ users }) {
  const validUsers = users || [];
  const visible = validUsers.slice(0, 4);
  const overflow = validUsers.length - 4;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* Online indicator */}
      <span style={{ color: '#1D9E75', fontSize: 12, marginRight: 8, whiteSpace: 'nowrap' }}>
        ● {validUsers.length} online
      </span>

      {/* Stacked avatars */}
      <div style={{ display: 'flex' }}>
        {visible.map((user, i) => (
          <div
            key={user.userId || i}
            title={user.userName}
            style={{
              width: 32, height: 32,
              borderRadius: '50%',
              background: user.color || '#C9A84C',
              color: '#0d0d1a',
              fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: i === 0 ? 0 : -8,
              border: '2px solid #0d0d1a',
              cursor: 'default',
              zIndex: visible.length - i,
              position: 'relative',
              transition: 'opacity 300ms ease',
            }}
          >
            {(user.userName || 'A')[0].toUpperCase()}
          </div>
        ))}
        {overflow > 0 && (
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(201,168,76,0.15)',
            color: '#C9A84C', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginLeft: -8, border: '2px solid #0d0d1a',
          }}>
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
