// src/pages/Landing.jsx
// Hero landing page with navbar, feature cards, and CTA.
import React from 'react';
import { useNavigate } from 'react-router-dom';

function Navbar({ darkMode, toggleTheme }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass"
         style={{ backgroundColor: 'rgba(var(--bg-rgb, 13,13,26), 0.85)' }}>
      <span className="text-2xl font-extrabold text-[#C9A84C] tracking-tight select-none">
        ⬛ BlackBoard
      </span>
      <button
        id="theme-toggle"
        onClick={toggleTheme}
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#C9A84C]/30
                   text-sm font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all duration-200"
      >
        {darkMode ? '☀️ Light' : '🌙 Dark'}
      </button>
    </nav>
  );
}

function FeatureCard({ icon, title, desc, accent }) {
  return (
    <div className="bb-card glass group flex flex-col gap-3 p-6 rounded-2xl
                    border border-white/5 hover:border-[#C9A84C]/30
                    transition-all duration-300 hover:-translate-y-1
                    hover:shadow-xl hover:shadow-[#C9A84C]/10 cursor-default">
      <div className="text-4xl">{icon}</div>
      <h3 className="text-xl font-bold" style={{ color: accent }}>{title}</h3>
      <p className="bb-muted text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

export default function Landing({ darkMode, toggleTheme }) {
  const navigate = useNavigate();

  const features = [
    {
      icon: '📅',
      title: 'Date Lock',
      accent: '#AFA9EC',
      desc: 'Set a future date. The board stays sealed until that exact moment — like a digital time capsule.',
    },
    {
      icon: '🔑',
      title: 'Password Lock',
      accent: '#ED93B1',
      desc: 'Protect your board with a secret password. Share the combo only with the people who matter.',
    },
    {
      icon: '⚡',
      title: 'Live Collab',
      accent: '#1D9E75',
      desc: 'Once unlocked, everyone edits together in real-time — cursor to cursor, keystroke by keystroke.',
    },
  ];

  return (
    <div className="bb-bg min-h-screen transition-colors duration-300">
      <Navbar darkMode={darkMode} toggleTheme={toggleTheme} />

      {/* ── Hero ────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center
                          min-h-screen text-center px-6 pt-20 overflow-hidden">
        {/* Background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#AFA9EC]/10 blur-[120px]" />
          <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#ED93B1]/10 blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                          w-[600px] h-[600px] rounded-full bg-[#C9A84C]/5 blur-[160px]" />
        </div>

        {/* Badge */}
        <div className="relative mb-6 px-4 py-1.5 rounded-full border border-[#C9A84C]/30
                        bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-semibold uppercase tracking-widest
                        animate-fade-in">
          🔒 Shareable · Time-locked · Real-time
        </div>

        {/* Headline */}
        <h1 className="relative text-5xl sm:text-7xl font-extrabold leading-tight mb-6 bb-text animate-slide-up">
          Lock your message.<br />
          <span className="gradient-text">Unlock the moment.</span>
        </h1>

        {/* Sub */}
        <p className="relative max-w-xl bb-muted text-lg mb-10 leading-relaxed animate-slide-up">
          Create a digital board. Lock it with a date, a password, or both.
          Share the link. Watch it come alive — together.
        </p>

        {/* CTA */}
        <button
          id="cta-create"
          onClick={() => navigate('/create')}
          className="btn-gold text-lg px-8 py-4 animate-slide-up"
        >
          ✨ Create a Board
        </button>

        <div className="absolute bottom-8 animate-bounce bb-muted text-2xl select-none opacity-40">↓</div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="relative px-6 pb-24 max-w-5xl mx-auto">
        <h2 className="text-center text-3xl font-bold mb-12 gradient-text">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {features.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="text-center py-6 bb-muted text-sm border-t border-white/5 opacity-50">
        Built with ⬛ BlackBoard · Real-time · Secure · Open
      </footer>
    </div>
  );
}
