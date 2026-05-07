// src/components/Editor.jsx
// Real-time collaborative editor using Socket.io.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL;

export default function Editor({ boardId, initialContent }) {
  const [content,    setContent]    = useState(initialContent || '');
  const [userCount,  setUserCount]  = useState(1);
  const [connected,  setConnected]  = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const socketRef   = useRef(null);
  const saveTimeout = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_board', { boardId });
    });

    socket.on('receive_update', ({ content: incoming }) => {
      setContent(incoming);
    });

    socket.on('user_joined', () => setUserCount(c => c + 1));
    socket.on('user_left',   () => setUserCount(c => Math.max(1, c - 1)));

    socket.on('disconnect', () => setConnected(false));
    socket.on('update_error', () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    });

    return () => socket.disconnect();
  }, [boardId]);

  const handleChange = useCallback((e) => {
    const newContent = e.target.value;
    setContent(newContent);
    setSaveStatus('saving');

    if (socketRef.current?.connected) {
      socketRef.current.emit('text_update', { boardId, content: newContent });
    }

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 800);
  }, [boardId]);

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#C9A84C]/20 bb-card">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-[#1D9E75]' : 'bg-[#ED93B1]'} animate-pulse`} />
          <span className="text-sm font-medium bb-text">
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1D9E75]/15 text-[#1D9E75] text-xs font-semibold">
            {userCount} {userCount === 1 ? 'user' : 'users'} online
          </span>
        </div>

        <div className="text-xs bb-muted">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 border border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          )}
          {saveStatus === 'saved'  && <span className="text-[#1D9E75]">✓ Saved</span>}
          {saveStatus === 'error'  && <span className="text-[#ED93B1]">⚠ Save failed</span>}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        id="board-editor"
        value={content}
        onChange={handleChange}
        placeholder="Start writing… your collaborators see changes in real-time ✨"
        className="flex-1 w-full resize-none p-6 text-base leading-relaxed outline-none
                   bb-bg bb-text placeholder-[var(--muted)] font-mono
                   transition-colors duration-300"
        spellCheck
      />
    </div>
  );
}
