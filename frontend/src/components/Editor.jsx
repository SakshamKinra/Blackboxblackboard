// src/components/Editor.jsx
// Real-time collaborative editor using Socket.io with image upload support.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
const API = process.env.REACT_APP_API_URL;

export default function Editor({ boardId, initialContent, attachedImages = [], socket, connected, userCount }) {
  const [content,    setContent]    = useState(initialContent || '');
  const [saveStatus, setSaveStatus] = useState('');
  const [uploading,  setUploading]  = useState(false);

  const saveTimeout = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveUpdate = ({ content: incoming }) => {
      setContent(incoming);
    };

    const handleImageAdded = ({ content: incoming }) => {
      setContent(incoming);
    };

    const handleUpdateError = () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    };

    socket.on('receive_update', handleReceiveUpdate);
    socket.on('image_added', handleImageAdded);
    socket.on('update_error', handleUpdateError);

    return () => {
      socket.off('receive_update', handleReceiveUpdate);
      socket.off('image_added', handleImageAdded);
      socket.off('update_error', handleUpdateError);
    };
  }, [socket]);

  const handleChange = useCallback((e) => {
    const newContent = e.target.value;
    setContent(newContent);
    setSaveStatus('saving');

    if (socket && connected) {
      socket.emit('text_update', { boardId, content: newContent });
    }

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 800);
  }, [boardId, socket, connected]);

  // Handle image upload
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

      if (data.success) {
        // Insert image markdown into content
        const imageMarkup = `\n![${file.name}](${API}${data.imageUrl})\n`;
        const newContent = content + imageMarkup;
        setContent(newContent);

        // Sync via socket
        if (socket && connected) {
          socket.emit('text_update', { boardId, content: newContent });
          socket.emit('image_added', { boardId, content: newContent, imageUrl: data.imageUrl });
        }

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2000);
      }
    } catch (err) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [boardId, content, socket, connected]);

  // Render content with inline images
  function renderContent(text) {
    if (!text) return null;
    // Match markdown-style images: ![alt](url)
    const parts = text.split(/(!\[.*?\]\(.*?\))/g);
    return parts.map((part, i) => {
      const match = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (match) {
        return (
          <div key={i} className="my-3 inline-block">
            <img
              src={match[2]}
              alt={match[1]}
              className="max-w-full max-h-80 rounded-lg border border-[#C9A84C]/20 shadow-lg"
              style={{ maxWidth: '100%' }}
            />
          </div>
        );
      }
      return part ? <span key={i}>{part}</span> : null;
    });
  }

  // Check if content has images to show preview
  const hasImages = /!\[.*?\]\(.*?\)/.test(content);

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

        <div className="flex items-center gap-3">
          {/* Image upload button */}
          <button
            id="image-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C]/20
                       text-sm font-medium text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload Image"
          >
            {uploading ? (
              <>
                <span className="w-3 h-3 border border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                Uploading…
              </>
            ) : '📎 Image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Save status */}
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
      </div>

      {/* Image preview area — shows rendered images when present */}
      {hasImages && (
        <div className="px-6 py-3 border-b border-[#C9A84C]/10 bb-card overflow-auto"
             style={{ maxHeight: '200px' }}>
          <div className="flex flex-wrap gap-3">
            {renderContent(content)}
          </div>
        </div>
      )}

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

      {/* Attached Images Gallery */}
      {attachedImages.length > 0 && (
        <div className="px-6 py-4 border-t border-[#C9A84C]/10 bg-[var(--card)] flex gap-4 overflow-x-auto shrink-0">
          {attachedImages.map((src, i) => (
            <img 
              key={i} 
              src={`${API}${src}`} 
              alt={`Attachment ${i+1}`} 
              className="max-h-[200px] rounded-lg object-contain shadow-lg cursor-pointer hover:opacity-90 transition-opacity" 
              onClick={() => window.open(`${API}${src}`, '_blank')} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
