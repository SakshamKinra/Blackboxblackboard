// src/pages/AdminLogin.jsx
// Admin login page — email + password form, midnight gold theme.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

export default function AdminLogin({ darkMode, toggleTheme }) {
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Please enter email and password.');

    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/admin/login`, { email, password });
      if (data.success) {
        localStorage.setItem('bb-admin-token', data.token);
        navigate('/admin/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bb-bg min-h-screen flex items-center justify-center transition-colors duration-300 px-4">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#AFA9EC]/10 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#ED93B1]/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[400px] h-[400px] rounded-full bg-[#C9A84C]/5 blur-[160px]" />
      </div>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <button onClick={() => navigate('/')} className="text-3xl font-extrabold text-[#C9A84C] tracking-tight mb-4 inline-block">
            ⬛ BlackBoard
          </button>
          <h1 className="text-2xl font-bold bb-text">Admin Login</h1>
          <p className="bb-muted text-sm mt-1">Access the admin dashboard</p>
        </div>

        {/* Login card */}
        <form
          onSubmit={handleLogin}
          className="bb-card glass rounded-2xl p-8 space-y-6 border border-white/5 animate-slide-up"
        >
          {/* Email */}
          <div>
            <label htmlFor="admin-email" className="block text-sm font-semibold text-[#C9A84C] mb-2 uppercase tracking-wider">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="admin@blackboard.com"
              className="bb-input"
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="admin-password" className="block text-sm font-semibold text-[#ED93B1] mb-2 uppercase tracking-wider">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter admin password…"
              className="bb-input"
              autoComplete="current-password"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="flex items-center gap-2 text-[#ED93B1] text-sm animate-fade-in">
              <span>⚠️</span> {error}
            </p>
          )}

          {/* Submit */}
          <button
            id="admin-login-btn"
            type="submit"
            disabled={loading}
            className="btn-gold w-full text-base flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-[#0d0d1a] border-t-transparent rounded-full animate-spin" />
                Logging in…
              </>
            ) : '🔐 Login'}
          </button>
        </form>

        {/* Theme toggle */}
        <div className="text-center mt-6">
          <button
            onClick={toggleTheme}
            className="text-xs bb-muted hover:text-[#C9A84C] transition-colors"
          >
            {darkMode ? '☀️ Switch to Light' : '🌙 Switch to Dark'}
          </button>
        </div>
      </div>
    </div>
  );
}
