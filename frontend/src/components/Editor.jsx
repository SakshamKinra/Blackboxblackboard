// src/components/Editor.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

export default function Editor({ boardId, initialContent, socket, connected, userCount, displayName }) {
  const [content, setContent] = useState(initialContent || '');
  const [saveStatus, setSaveStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [contributors, setContributors] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  const saveTimeout = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setContent(initialContent || '');
  }, [initialContent]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveUpdate = ({ content: incoming }) => {
      setContent(incoming);
    };

    const handleAuthoredUpdate = ({ userName, content: latest, timestamp }) => {
      setContributors((prev) => {
        const filtered = prev.filter((item) => item.userName !== userName);
        return [{ userName, latest: (latest || '').slice(-120), timestamp }, ...filtered].slice(0, 8);
      });
    };

    const handleTyping = ({ userName }) => {
      if (!userName || userName === displayName) return;
      setTypingUsers((prev) => (prev.includes(userName) ? prev : [...prev, userName]));
      window.setTimeout(() => {
        setTypingUsers((prev) => prev.filter((name) => name !== userName));
      }, 1800);
    };

    const handleUpdateError = () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    };

    socket.on('receive_update', handleReceiveUpdate);
    socket.on('text_update_author', handleAuthoredUpdate);
    socket.on('text_typing', handleTyping);
    socket.on('update_error', handleUpdateError);

    return () => {
      socket.off('receive_update', handleReceiveUpdate);
      socket.off('text_update_author', handleAuthoredUpdate);
      socket.off('text_typing', handleTyping);
      socket.off('update_error', handleUpdateError);
    };
  }, [socket, displayName]);

  const handleChange = useCallback((e) => {
    const newContent = e.target.value;
    setContent(newContent);
    setSaveStatus('saving');

    if (socket && connected) {
      socket.emit('text_update', { boardId, content: newContent, userName: displayName });
      socket.emit('text_typing', { boardId, userName: displayName });
    }

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 800);

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setTypingUsers((prev) => prev.filter((n) => n !== displayName)), 1500);
  }, [boardId, socket, connected, displayName]);

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const { data } = await axios.post(`${API}/api/boards/${boardId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.success && socket && connected) {
        const whiteboardImage = {
          ...data.image,
          src: `${API}${data.imageUrl}`,
          userName: displayName,
        };
        socket.emit('whiteboard_image_added', { boardId, image: whiteboardImage });
        socket.emit('image_added', { boardId, imageUrl: data.imageUrl, userName: displayName });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2000);
      }
    } catch (err) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [boardId, socket, connected, displayName]);

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#C9A84C]/20 bb-card">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-[#1D9E75]' : 'bg-[#ED93B1]'} animate-pulse`} />
          <span className="text-sm font-medium bb-text">{connected ? 'Live' : 'Reconnecting…'}</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1D9E75]/15 text-[#1D9E75] text-xs font-semibold">
            {userCount} {userCount === 1 ? 'user' : 'users'} online
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="image-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C]/20 text-sm font-medium text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload Image to Whiteboard"
          >
            {uploading ? 'Uploading…' : '📎 Image to Whiteboard'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <div className="text-xs bb-muted">
            {saveStatus === 'saving' && <span>Saving…</span>}
            {saveStatus === 'saved' && <span className="text-[#1D9E75]">✓ Saved</span>}
            {saveStatus === 'error' && <span className="text-[#ED93B1]">⚠ Save failed</span>}
          </div>
        </div>
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-xs border-b border-[#C9A84C]/10 bg-[var(--card)]">
          <span className="text-[#C9A84C] font-semibold">Typing:</span> {typingUsers.join(', ')}
        </div>
      )}

      <textarea
        id="board-editor"
        value={content}
        onChange={handleChange}
        placeholder="Start writing... everyone sees live updates with names."
        className="flex-1 w-full resize-none p-6 text-base leading-relaxed outline-none bb-bg bb-text placeholder-[var(--muted)] font-mono transition-colors duration-300"
        spellCheck
      />

      <div className="px-6 py-4 border-t border-[#C9A84C]/10 bg-[var(--card)]/50">
        <p className="text-xs uppercase tracking-widest text-[#C9A84C] font-bold mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#C9A84C]"></span>
          Recent Contributions
        </p>
        {contributors.length === 0 ? (
          <p className="text-xs bb-muted italic">No remote updates yet. Your changes are saved automatically.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {contributors.map((entry) => (
              <div key={`${entry.userName}-${entry.timestamp}`} className="text-xs bb-text bg-[var(--bg)] border border-[#C9A84C]/20 rounded-xl p-3 shadow-sm flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#C9A84C]">{entry.userName}</span>
                  <span className="text-[10px] opacity-50">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="opacity-80 line-clamp-2 italic">
                  "{entry.latest || '...'}"
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
