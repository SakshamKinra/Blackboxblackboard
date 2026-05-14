// src/pages/CreateWhiteboard.jsx
// Form to create a new standalone whiteboard.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

export default function CreateWhiteboard({ darkMode, toggleTheme }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await axios.post(`${API}/api/whiteboards`, {
        title: title.trim() || 'Untitled Whiteboard',
      });
      if (data.success && data.whiteboardId) {
        navigate(`/whiteboard/${data.whiteboardId}`);
      } else {
        setError('Failed to create whiteboard. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bb-bg min-h-screen transition-colors duration-300 px-4">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-[#AFA9EC]/10 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-[#ED93B1]/10 blur-[120px]" />
      </div>

      {/* Navbar Minimal */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass">
        <button onClick={() => navigate('/')} className="text-2xl font-extrabold text-[#C9A84C] tracking-tight">
          ⬛ BlackBoard
        </button>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#C9A84C]/30 text-sm font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all"
        >
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
      </nav>

      {/* Form Container */}
      <div className="flex flex-col items-center justify-center min-h-screen pt-20 pb-12">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-10 animate-fade-in text-center">
          <h1 className="font-playfair text-4xl font-extrabold gradient-text mb-2">Create a Whiteboard</h1>
          <p className="bb-muted">Instantly create a shareable, real-time standalone whiteboard.</p>
        </div>

          <form onSubmit={handleCreate} className="bb-card glass rounded-2xl p-8 space-y-6 shadow-xl border border-white/5">
            <div>
              <label htmlFor="wb-title" className="block text-sm font-semibold text-[#C9A84C] mb-2 uppercase tracking-wider">
                Whiteboard Title <span className="text-[#8878a8] text-xs font-normal normal-case">(Optional)</span>
              </label>
              <input
                id="wb-title"
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(''); }}
                placeholder="e.g. Brainstorming Session"
                className="bb-input w-full"
                maxLength={50}
              />
            </div>

            {error && (
              <p className="text-[#ED93B1] text-sm animate-fade-in flex items-center gap-2">
                <span>⚠️</span> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full text-base flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : '🎨 Create Whiteboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
