// src/pages/AdminDashboard.jsx
// Protected admin dashboard — shows all boards with metadata.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

export default function AdminDashboard({ darkMode, toggleTheme }) {
  const navigate = useNavigate();

  const [boards,      setBoards]      = useState([]);
  const [whiteboards, setWhiteboards] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  useEffect(() => {
    const token = localStorage.getItem('bb-admin-token');
    if (!token) {
      navigate('/admin');
      return;
    }

    async function fetchData() {
      try {
        const [boardsRes, wbsRes] = await Promise.all([
          axios.get(`${API}/api/admin/boards`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/api/admin/whiteboards`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        if (boardsRes.data.success) setBoards(boardsRes.data.boards);
        if (wbsRes.data.success) setWhiteboards(wbsRes.data.whiteboards);
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('bb-admin-token');
          navigate('/admin');
          return;
        }
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('bb-admin-token');
    navigate('/admin');
  }

  const handleNuke = async (type) => {
    if (type === 'all') {
      if (!window.confirm('WARNING: You are about to delete ALL boards and whiteboards. This cannot be undone.')) return;
      if (!window.confirm('Are you absolutely sure?')) return;
    } else {
      if (!window.confirm(`Are you sure you want to delete ${type} boards?`)) return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('bb-admin-token');
      const endpoint = type === 'wb-expired' ? 'whiteboards/expired' : `boards/${type}`;
      const { data } = await axios.delete(`${API}/api/admin/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        alert(data.message);
        // Refetch data
        const [boardsRes, wbsRes] = await Promise.all([
          axios.get(`${API}/api/admin/boards`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/api/admin/whiteboards`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (boardsRes.data.success) setBoards(boardsRes.data.boards);
        if (wbsRes.data.success) setWhiteboards(wbsRes.data.whiteboards);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally {
      setLoading(false);
    }
  };

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function getExpiryStatus(board) {
    if (board.isExpired) return { label: 'Expired', color: '#ED93B1' };
    if (!board.activatedAt) return { label: 'Not activated', color: '#8878a8' };
    const expiryTime = new Date(board.activatedAt).getTime() + board.expiresAfter * 60 * 60 * 1000;
    if (Date.now() > expiryTime) return { label: 'Expired', color: '#ED93B1' };
    const hoursLeft = Math.max(0, ((expiryTime - Date.now()) / (1000 * 60 * 60))).toFixed(1);
    return { label: `${hoursLeft}h left`, color: '#1D9E75' };
  }

  const lockTypeIcons = { date: '📅', password: '🔑', both: '🔒' };

  return (
    <div className="bb-bg min-h-screen transition-colors duration-300">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass" style={{ backgroundColor: 'var(--nav-bg)' }}>
        <button onClick={() => navigate('/')} className="text-2xl font-extrabold text-[#C9A84C] tracking-tight">
          ⬛ BlackBoard
        </button>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-semibold uppercase tracking-wider">
            Admin
          </span>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-full border border-[#C9A84C]/30
                       text-sm font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button
            id="admin-logout-btn"
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: 'var(--btn-danger-bg)', color: 'var(--btn-danger-text)' }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-16">
        <div className="mb-8 animate-fade-in flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold gradient-text mb-1">Admin Dashboard</h1>
            <p className="bb-muted text-sm">
              {boards.length} board{boards.length !== 1 ? 's' : ''} total
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => handleNuke('expired')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#ED93B1]/40 text-[#ED93B1] hover:bg-[#ED93B1]/10 text-xs font-semibold transition-all">
              🗑️ Expired Boards
            </button>
            <button onClick={() => handleNuke('wb-expired')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 text-xs font-semibold transition-all">
              🗑️ Expired Whiteboards
            </button>
            <button onClick={() => handleNuke('old')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#AFA9EC]/40 text-[#AFA9EC] hover:bg-[#AFA9EC]/10 text-xs font-semibold transition-all">
              🗑️ >7 Days Old
            </button>
            <button onClick={() => handleNuke('all')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 text-xs font-bold transition-all">
              💣 Delete All
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bb-muted gap-4">
            <div className="w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Loading boards…</p>
          </div>
        )}

        {error && (
          <p className="text-[#ED93B1] text-sm mb-4 flex items-center gap-2 animate-fade-in">
            <span>⚠️</span> {error}
          </p>
        )}

        {!loading && !error && boards.length === 0 && (
          <div className="text-center py-20 bb-muted animate-fade-in">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-lg font-semibold">No boards yet</p>
            <p className="text-sm mt-1">Boards created by users will appear here.</p>
          </div>
        )}

        {!loading && boards.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/5 animate-slide-up">
            <table className="w-full text-left">
              <thead>
                <tr className="bb-card border-b border-[#C9A84C]/10">
                  <th className="px-5 py-4 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Board Name</th>
                  <th className="px-5 py-4 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Board ID</th>
                  <th className="px-5 py-4 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Created</th>
                  <th className="px-5 py-4 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Lock Type</th>
                  <th className="px-5 py-4 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Expiry Status</th>
                </tr>
              </thead>
              <tbody>
                {boards.map((board, i) => {
                  const expiry = getExpiryStatus(board);
                  return (
                    <tr
                      key={board.boardId}
                      className={`border-b border-white/5 transition-colors hover:bg-[#C9A84C]/5
                                  ${i % 2 === 0 ? 'bb-card' : 'bb-bg'}`}
                    >
                      <td className="px-5 py-4 text-sm bb-text font-medium">
                        {board.boardName || 'Untitled Board'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono px-2 py-1 rounded-lg bg-[#C9A84C]/10 text-[#C9A84C]">
                          {board.boardId}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm bb-muted">{formatDate(board.createdAt)}</td>
                      <td className="px-5 py-4 text-sm bb-text">
                        <span className="flex items-center gap-1.5">
                          {lockTypeIcons[board.unlockType]} {board.unlockType}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            color: expiry.color,
                            backgroundColor: `${expiry.color}15`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: expiry.color }} />
                          {expiry.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Whiteboards Section */}
        <div className="mt-16 mb-8 animate-fade-in">
          <h2 className="text-2xl font-bold bb-text mb-1">Standalone Whiteboards</h2>
          <p className="bb-muted text-sm">{whiteboards.length} whiteboard{whiteboards.length !== 1 ? 's' : ''} total</p>
        </div>

        {!loading && !error && whiteboards.length === 0 && (
          <div className="text-center py-10 bb-muted animate-fade-in bb-card rounded-2xl border border-white/5">
            <p className="text-sm">No standalone whiteboards yet.</p>
          </div>
        )}

        {!loading && whiteboards.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/5 animate-slide-up mb-20">
            <table className="w-full text-left">
              <thead>
                <tr className="bb-card border-b border-[#C9A84C]/10">
                  <th className="px-5 py-4 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Title</th>
                  <th className="px-5 py-4 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">ID</th>
                  <th className="px-5 py-4 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Created</th>
                  <th className="px-5 py-4 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Expires At</th>
                </tr>
              </thead>
              <tbody>
                {whiteboards.map((wb, i) => (
                  <tr key={wb.whiteboardId} className={`border-b border-white/5 transition-colors hover:bg-[#C9A84C]/5 ${i % 2 === 0 ? 'bb-card' : 'bb-bg'}`}>
                    <td className="px-5 py-4 text-sm bb-text font-medium">{wb.title || 'Untitled Whiteboard'}</td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-mono px-2 py-1 rounded-lg bg-[#AFA9EC]/10 text-[#AFA9EC]">
                        {wb.whiteboardId}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm bb-muted">{formatDate(wb.createdAt)}</td>
                    <td className="px-5 py-4 text-sm">
                      <span className={new Date(wb.expiresAt) < new Date() ? 'text-[#ED93B1]' : 'text-[#1D9E75]'}>
                        {formatDate(wb.expiresAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
