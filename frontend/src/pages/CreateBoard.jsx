// src/pages/CreateBoard.jsx
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Paperclip, X } from 'lucide-react';

const API = process.env.REACT_APP_API_URL;

function Navbar({ darkMode, toggleTheme, navigate }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass" style={{ backgroundColor: 'var(--nav-bg)' }}>
      <button onClick={() => navigate('/')} className="text-2xl font-extrabold text-[#C9A84C] tracking-tight">
        ⬛ BlackBoard
      </button>
      <button
        id="theme-toggle"
        onClick={toggleTheme}
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#C9A84C]/30
                   text-sm font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all"
      >
        {darkMode ? '☀️ Light' : '🌙 Dark'}
      </button>
    </nav>
  );
}

export default function CreateBoard({ darkMode, toggleTheme }) {
  const navigate = useNavigate();

  const [unlockType, setUnlockType] = useState('date');
  const [unlockAt,   setUnlockAt]   = useState('');
  const [password,   setPassword]   = useState('');
  const [content,    setContent]    = useState('');
  const [boardName,     setBoardName]     = useState('');
  const [expiresAfter,  setExpiresAfter]  = useState('');
  const [attachments,   setAttachments]   = useState([]);
  const fileInputRef = useRef(null);

  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [shareableLink, setShareableLink] = useState('');
  const [copied,        setCopied]        = useState(false);

  const needsDate     = unlockType === 'date'     || unlockType === 'both';
  const needsPassword = unlockType === 'password' || unlockType === 'both';

  async function handleCreate() {
    setError('');
    setShareableLink('');
    if (needsDate && !unlockAt)    return setError('Please pick an unlock date and time.');
    if (needsPassword && !password) return setError('Please enter a password for this board.');

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('unlockType', unlockType);
      if (boardName.trim()) formData.append('boardName', boardName.trim());
      if (needsDate && unlockAt) formData.append('unlockAt', new Date(unlockAt).toISOString());
      if (needsPassword && password) formData.append('password', password);
      if (expiresAfter) formData.append('expiresAfter', Number(expiresAfter));
      
      attachments.forEach(file => {
        formData.append('images', file);
      });

      const { data } = await axios.post(`${API}/api/boards`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) setShareableLink(data.shareableLink);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create board. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareableLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const boardId = shareableLink?.split('/').pop();

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    e.target.value = ''; // reset
    
    if (attachments.length + files.length > 2) {
      setError('Maximum 2 images allowed');
      return;
    }
    
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Image must be under 10MB');
        return;
      }
    }
    
    setAttachments(prev => [...prev, ...files].slice(0, 2));
    setError('');
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bb-bg min-h-screen transition-colors duration-300 pb-20">
      <Navbar darkMode={darkMode} toggleTheme={toggleTheme} navigate={navigate} />

      {/* Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 right-0 w-96 h-96 rounded-full bg-[#AFA9EC]/10 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-[#ED93B1]/10 blur-[100px]" />
      </div>

      <div className="max-w-2xl mx-auto px-6 pt-28">

        <div className="mb-10 animate-fade-in">
          <h1 className="font-playfair text-4xl font-extrabold gradient-text mb-2">Create a Board</h1>
          <p className="bb-muted">Configure your lock, add initial content, and share the link.</p>
        </div>

        <div className="bb-card glass rounded-2xl p-8 space-y-7 border border-white/5 animate-slide-up">

          {/* Lock type */}
          <div>
            <label className="block text-sm font-semibold text-[#C9A84C] mb-3 uppercase tracking-wider">
              Lock Type
            </label>
            <div className="flex gap-3">
              {['date', 'password', 'both'].map(type => (
                <button
                  key={type}
                  id={`lock-type-${type}`}
                  onClick={() => setUnlockType(type)}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold capitalize
                              border transition-all duration-200
                              ${unlockType === type
                                ? 'bg-[#C9A84C] text-[#0d0d1a] border-[#C9A84C] shadow-lg shadow-[#C9A84C]/30'
                                : 'border-[#C9A84C]/20 text-[#8878a8] hover:border-[#C9A84C]/50 hover:text-[#C9A84C]'
                              }`}
                >
                  {type === 'date' ? '📅 Date' : type === 'password' ? '🔑 Password' : '🔒 Both'}
                </button>
              ))}
            </div>
          </div>

          {/* Board Name */}
          <div className="animate-fade-in">
            <label htmlFor="board-name" className="block text-sm font-semibold text-[#C9A84C] mb-2 uppercase tracking-wider">
              Board Name <span className="text-xs normal-case bb-muted">(optional)</span>
            </label>
            <input
              id="board-name"
              type="text"
              value={boardName}
              onChange={e => setBoardName(e.target.value)}
              placeholder="Give your board a name…"
              className="bb-input"
              maxLength={100}
            />
          </div>

          {/* Date */}
          {needsDate && (
            <div className="animate-fade-in">
              <label htmlFor="unlock-date" className="block text-sm font-semibold text-[#AFA9EC] mb-2 uppercase tracking-wider">
                Unlock Date & Time
              </label>
              <input
                id="unlock-date"
                type="datetime-local"
                value={unlockAt}
                onChange={e => setUnlockAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="bb-input"
              />
            </div>
          )}

          {/* Password */}
          {needsPassword && (
            <div className="animate-fade-in">
              <label htmlFor="board-password" className="block text-sm font-semibold text-[#ED93B1] mb-2 uppercase tracking-wider">
                Password
              </label>
              <input
                id="board-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Choose a strong password…"
                className="bb-input"
              />
            </div>
          )}

          {/* Content */}
          <div>
            <label htmlFor="board-content" className="block text-sm font-semibold bb-muted mb-2 uppercase tracking-wider">
              Initial Content <span className="text-xs normal-case">(optional)</span>
            </label>
            <textarea
              id="board-content"
              rows={5}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write something to lock away… or leave empty to start fresh."
              className="bb-input resize-none font-mono leading-relaxed mb-3"
            />
            
            {/* Attachment UI */}
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-sm font-medium bb-muted hover:text-[#C9A84C] transition-colors mb-3"
              >
                <Paperclip size={16} /> Attach images
              </button>
              <input 
                type="file" 
                multiple 
                accept="image/jpeg, image/png, image/gif, image/webp"
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              
              {attachments.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                  {attachments.map((file, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="preview" 
                        className="w-20 h-20 object-cover rounded-lg border border-[#C9A84C]/30"
                      />
                      <button
                        onClick={() => removeAttachment(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Link Expiry */}
          <div className="animate-fade-in">
            <label htmlFor="expires-after" className="block text-sm font-semibold text-[#ED93B1] mb-2 uppercase tracking-wider">
              Link Expiry <span className="text-xs normal-case bb-muted">(optional)</span>
            </label>
            <input
              id="expires-after"
              type="number"
              min={1}
              max={48}
              value={expiresAfter}
              onChange={e => setExpiresAfter(e.target.value)}
              placeholder="Default: 3 hours, max 48, min 1"
              className="bb-input"
            />
            <p className="text-xs bb-muted mt-1.5">How many hours the link stays valid after first unlock.</p>
          </div>

          {/* Error */}
          {error && (
            <p className="flex items-center gap-2 text-[#ED93B1] text-sm animate-fade-in">
              <span>⚠️</span> {error}
            </p>
          )}

          {/* Submit */}
          <button
            id="generate-link-btn"
            onClick={handleCreate}
            disabled={loading}
            className="btn-gold w-full text-base flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-[#0d0d1a] border-t-transparent rounded-full animate-spin" />
                Creating…
              </>
            ) : '🔗 Generate Shareable Link'}
          </button>
        </div>

        {/* Success */}
        {shareableLink && (
          <div className="mt-8 p-6 rounded-2xl border border-[#1D9E75]/30 bg-[#1D9E75]/5 animate-slide-up">
            <p className="text-[#1D9E75] font-bold text-lg mb-3">🎉 Board Created!</p>
            <p className="bb-muted text-sm mb-4">Share this link with your collaborators:</p>

            <div className="flex items-center gap-2 rounded-xl px-4 py-3 border border-[#1D9E75]/20"
                 style={{ backgroundColor: 'var(--bg)' }}>
              <span className="flex-1 text-sm bb-text break-all font-mono">{shareableLink}</span>
              <button
                id="copy-link-btn"
                onClick={copyLink}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-[#1D9E75]/20 text-[#1D9E75] text-xs
                           font-semibold hover:bg-[#1D9E75]/30 transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>

            <button
              id="open-board-btn"
              onClick={() => navigate(`/board/${boardId}`)}
              className="mt-4 w-full btn-gold"
            >
              Open Board →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
