// src/pages/Landing.jsx
// Hero landing page with navbar, feature sections, use cases, and CTA.
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Shield, Zap, CheckCircle2, Lock, Gift, PartyPopper, GraduationCap } from 'lucide-react';

const landingStyles = `
  @media (prefers-reduced-motion: no-preference) {
    .animate-on-scroll {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .animate-on-scroll.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .float-anim {
      animation: float 6s ease-in-out infinite;
    }
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    .hover-lift {
      transition: transform 200ms ease, border-color 200ms ease;
    }
    .hover-lift:hover {
      transform: translateY(-4px);
    }
    
    .stagger-1 { transition-delay: 100ms; }
    .stagger-2 { transition-delay: 200ms; }
    .stagger-3 { transition-delay: 300ms; }
    .stagger-4 { transition-delay: 400ms; }
  }

  .glass-card {
    backdrop-filter: blur(16px);
    border: 1px solid rgba(201, 168, 76, 0.2);
    background-color: var(--card-bg, #13132b);
  }
`;

function Navbar({ darkMode, toggleTheme, navigate }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass"
         style={{ backgroundColor: 'var(--nav-bg)' }}>
      <button onClick={() => navigate('/')} className="text-2xl font-extrabold text-[#C9A84C] tracking-tight select-none">
        ⬛ BlackBoard
      </button>
      <div className="flex-1 flex items-center justify-end gap-6 pr-6">
        <button onClick={() => navigate('/create')} className="text-sm font-semibold hover:text-[#C9A84C] transition-colors" style={{ color: 'var(--nav-text)' }}>
          Text Board
        </button>
        <button onClick={() => navigate('/whiteboard/new')} className="text-sm font-semibold hover:text-[#C9A84C] transition-colors" style={{ color: 'var(--nav-text)' }}>
          Whiteboard
        </button>
      </div>
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

export default function Landing({ darkMode, toggleTheme }) {
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  return (
    <div className="bb-bg min-h-screen transition-colors duration-300 overflow-hidden">
      <style>{landingStyles}</style>
      <Navbar darkMode={darkMode} toggleTheme={toggleTheme} navigate={navigate} />

      {/* ── SECTION 1: Hero ────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-24 pb-16">
        {/* Subtle radial glow bloom top right */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full bg-[rgba(201,168,76,0.06)] blur-[140px] pointer-events-none" />

        {/* Badge */}
        <div className="animate-on-scroll is-visible relative mb-8 px-5 py-1.5 rounded-full border border-[#C9A84C] text-[#C9A84C] text-xs font-semibold tracking-wide">
          ✦ No login required · Share instantly
        </div>

        {/* Headline */}
        <h1 className="animate-on-scroll is-visible stagger-1 relative text-5xl md:text-7xl font-extrabold leading-tight mb-6 max-w-4xl mx-auto bb-text">
          Lock your message.<br />
          <span className="text-[#C9A84C]">Unlock the moment.</span>
        </h1>

        {/* Sub */}
        <p className="animate-on-scroll is-visible stagger-2 relative max-w-xl bb-muted text-lg mb-10 leading-relaxed mx-auto">
          Create a digital board. Lock it with a date, a password, or both. Share the link. Watch it come alive — together.
        </p>

        {/* CTA */}
        <div className="animate-on-scroll is-visible stagger-3 flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 relative z-10 w-full max-w-lg mx-auto">
          <button
            onClick={() => navigate('/create')}
            className="w-full sm:w-auto text-lg px-8 py-4 rounded-full font-bold shadow-lg shadow-[#C9A84C]/20 transition-all duration-300"
            style={{ backgroundColor: '#C9A84C', color: '#0d0d1a' }}
          >
            ✨ Create a Board
          </button>
          <button
            onClick={() => navigate('/whiteboard/new')}
            className="w-full sm:w-auto text-lg px-8 py-4 rounded-full border-2 border-[#C9A84C] text-[#C9A84C] bg-transparent hover:bg-[#C9A84C] hover:text-[#0d0d1a] transition-all duration-300 font-bold flex items-center justify-center gap-2"
          >
            🎨 Create a Whiteboard
          </button>
        </div>

        {/* Inline Feature Chips */}
        <div className="animate-on-scroll is-visible stagger-3 flex flex-wrap justify-center gap-4 text-sm font-medium bb-muted mb-16 relative z-10">
          <span className="flex items-center gap-2">🔒 Date lock</span>
          <span className="bb-muted/30">·</span>
          <span className="flex items-center gap-2">🔑 Password lock</span>
          <span className="bb-muted/30">·</span>
          <span className="flex items-center gap-2">⚡ Live collab</span>
        </div>

        {/* Admin Portal Card - Centered below CTA */}
        <div className="relative mx-auto mt-12 animate-[float_6s_infinite] glass-card rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center border border-white/10 z-20 hover:scale-105 transition-transform duration-300 w-full max-w-sm" style={{ backgroundColor: darkMode ? '#13132b' : '#fff8f0' }}>
          <div className="text-4xl mb-3 opacity-80 select-none">🛡️</div>
          <div className="text-xl font-bold mb-1" style={{ color: darkMode ? '#f5ecd7' : '#2a1f0e' }}>Login</div>
          <div className="text-xs mb-4 text-center max-w-[200px]" style={{ color: darkMode ? 'var(--muted)' : '#2a1f0e' }}>Manage boards, settings, and cleanup</div>
          <button onClick={() => navigate('/admin')} className="btn-gold w-full py-2 text-sm">Login to access</button>
        </div>
      </section>

      {/* ── SECTION 2: Problem ────────────────────────────────── */}
      <section className="relative px-6 py-24 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="animate-on-scroll glass-card rounded-2xl p-8 hover-lift border-l-4 border-l-[#C9A84C]" style={{ backgroundColor: darkMode ? '#13132b' : '#fff8f0' }}>
            <div className="text-3xl font-mono font-bold mb-4" style={{ color: darkMode ? '#8878a8' : '#b09880' }}>01</div>
            <h3 className="text-xl font-bold mb-3" style={{ color: darkMode ? '#f5ecd7' : '#2a1f0e' }}>Wrong timing ruins everything</h3>
            <p className="leading-relaxed" style={{ color: darkMode ? '#8878a8' : '#2a1f0e' }}>You can't unsend a heartfelt message that landed at the wrong moment.</p>
          </div>
          <div className="animate-on-scroll stagger-1 glass-card rounded-2xl p-8 hover-lift border-l-4 border-l-[#C9A84C]" style={{ backgroundColor: darkMode ? '#13132b' : '#fff8f0' }}>
            <div className="text-3xl font-mono font-bold mb-4" style={{ color: darkMode ? '#8878a8' : '#b09880' }}>02</div>
            <h3 className="text-xl font-bold mb-3" style={{ color: darkMode ? '#f5ecd7' : '#2a1f0e' }}>No anticipation, no magic</h3>
            <p className="leading-relaxed" style={{ color: darkMode ? '#8878a8' : '#2a1f0e' }}>Modern platforms show everything instantly. There's no build-up, no excitement.</p>
          </div>
          <div className="animate-on-scroll stagger-2 glass-card rounded-2xl p-8 hover-lift border-l-4 border-l-[#C9A84C]" style={{ backgroundColor: darkMode ? '#13132b' : '#fff8f0' }}>
            <div className="text-3xl font-mono font-bold mb-4" style={{ color: darkMode ? '#8878a8' : '#b09880' }}>03</div>
            <h3 className="text-xl font-bold mb-3" style={{ color: darkMode ? '#f5ecd7' : '#2a1f0e' }}>No space to react together</h3>
            <p className="leading-relaxed" style={{ color: darkMode ? '#8878a8' : '#2a1f0e' }}>Once someone sees your message, there's no shared space to respond and celebrate.</p>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: Alternating Rows ───────────────────────── */}
      <section className="relative px-6 py-24 max-w-6xl mx-auto flex flex-col gap-32">
        
        {/* Row 1 */}
        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 w-full animate-on-scroll">
            <div className="glass-card rounded-2xl p-8 aspect-[4/3] flex flex-col items-center justify-center">
              <div className="bg-[var(--bg)] border border-[#C9A84C]/30 rounded-xl p-6 shadow-xl w-full max-w-xs text-center">
                <div className="text-4xl mb-4">📅</div>
                <div className="text-xs uppercase text-[#C9A84C] font-semibold mb-2 tracking-widest">Unlocks On</div>
                <div className="text-xl font-mono bb-text">May 15, 2026</div>
                <div className="text-sm bb-muted mt-1">12:00 AM</div>
              </div>
            </div>
          </div>
          <div className="flex-1 animate-on-scroll stagger-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#AFA9EC]/10 text-[#AFA9EC] text-xs font-bold uppercase tracking-wider mb-6 border border-[#AFA9EC]/20">
              <Calendar size={14} /> Date Lock
            </div>
            <h2 className="text-3xl md:text-4xl font-bold bb-text mb-4">Your message, delivered at the perfect moment</h2>
            <p className="bb-muted text-lg mb-8 leading-relaxed">Set an exact date and time. Your board stays sealed until that moment arrives — whether it's a birthday at midnight or an anniversary morning.</p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 bb-muted"><CheckCircle2 className="text-[#C9A84C] shrink-0 mt-0.5" size={20} /> <span>Exact date + time control</span></li>
              <li className="flex items-start gap-3 bb-muted"><CheckCircle2 className="text-[#C9A84C] shrink-0 mt-0.5" size={20} /> <span>Server-validated, cheat-proof</span></li>
              <li className="flex items-start gap-3 bb-muted"><CheckCircle2 className="text-[#C9A84C] shrink-0 mt-0.5" size={20} /> <span>Live countdown for the recipient</span></li>
            </ul>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-12 lg:gap-20">
          <div className="flex-1 w-full animate-on-scroll">
            <div className="glass-card rounded-2xl p-8 aspect-[4/3] flex items-center justify-center">
              <div className="w-full max-w-xs">
                <div className="text-center text-5xl mb-6">🔑</div>
                <div className="relative">
                  <input type="password" placeholder="••••••••" className="w-full bg-[var(--bg)] border-2 border-[#C9A84C]/50 rounded-xl py-4 px-4 text-center text-xl tracking-[0.3em] bb-text outline-none" disabled />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#C9A84C]">
                    <Lock size={20} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 animate-on-scroll stagger-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ED93B1]/10 text-[#ED93B1] text-xs font-bold uppercase tracking-wider mb-6 border border-[#ED93B1]/20">
              <Shield size={14} /> Password Lock
            </div>
            <h2 className="text-3xl md:text-4xl font-bold bb-text mb-4">Only the ones who know can enter</h2>
            <p className="bb-muted text-lg mb-8 leading-relaxed">Share the secret with whoever deserves it. Everyone else sees a lock. Passwords are hashed and never stored in plain text.</p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 bb-muted"><CheckCircle2 className="text-[#C9A84C] shrink-0 mt-0.5" size={20} /> <span>bcrypt encrypted passwords</span></li>
              <li className="flex items-start gap-3 bb-muted"><CheckCircle2 className="text-[#C9A84C] shrink-0 mt-0.5" size={20} /> <span>Wrong password = no hints</span></li>
              <li className="flex items-start gap-3 bb-muted"><CheckCircle2 className="text-[#C9A84C] shrink-0 mt-0.5" size={20} /> <span>Combine with date for double lock</span></li>
            </ul>
          </div>
        </div>

        {/* Row 3 */}
        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 w-full animate-on-scroll">
            <div className="glass-card rounded-2xl p-6 relative overflow-hidden aspect-[4/3] flex flex-col bg-[var(--bg)]" style={{ backgroundColor: darkMode ? '#13132b' : '#fff8f0' }}>
              <div className="flex items-center gap-2 mb-4 border-b border-[#C9A84C]/10 pb-3">
                <div className="w-3 h-3 rounded-full bg-[#ED93B1]"></div>
                <div className="w-3 h-3 rounded-full bg-[#C9A84C]"></div>
                <div className="w-3 h-3 rounded-full bg-[#AFA9EC]"></div>
              </div>
              <div className="relative font-mono text-sm leading-relaxed h-full" style={{ color: darkMode ? '#f5ecd7' : '#2a1f0e' }}>
                Happy birthday! So glad we could finally |
                
                {/* Simulated Cursors */}
                <div className="absolute top-[40px] left-[50px] animate-pulse">
                  <div className="text-[10px] font-sans bg-[#C9A84C] text-[#13132b] px-1.5 py-0.5 rounded-sm font-bold shadow-sm">Sarah</div>
                  <div className="w-0.5 h-4 bg-[#C9A84C]"></div>
                </div>
                
                <div className="absolute top-[70px] left-[150px] animate-pulse" style={{ animationDelay: '500ms' }}>
                  <div className="text-[10px] font-sans bg-[#AFA9EC] text-[#13132b] px-1.5 py-0.5 rounded-sm font-bold shadow-sm">Alex</div>
                  <div className="w-0.5 h-4 bg-[#AFA9EC]"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 animate-on-scroll stagger-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] text-xs font-bold uppercase tracking-wider mb-6 border border-[#1D9E75]/20">
              <Zap size={14} /> Live Collab
            </div>
            <h2 className="text-3xl md:text-4xl font-bold bb-text mb-4">After the reveal, everyone writes together</h2>
            <p className="bb-muted text-lg mb-8 leading-relaxed">Once unlocked, the board becomes a shared space. Multiple people, one board, changes synced in real time.</p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 bb-muted"><CheckCircle2 className="text-[#C9A84C] shrink-0 mt-0.5" size={20} /> <span>Socket.io powered sync</span></li>
              <li className="flex items-start gap-3 bb-muted"><CheckCircle2 className="text-[#C9A84C] shrink-0 mt-0.5" size={20} /> <span>No refresh needed</span></li>
              <li className="flex items-start gap-3 bb-muted"><CheckCircle2 className="text-[#C9A84C] shrink-0 mt-0.5" size={20} /> <span>Draw together on the whiteboard</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: Stats bar ──────────────────────────────── */}
      <section className="relative w-full py-10" style={{ backgroundColor: darkMode ? '#0d0d1a' : '#fff8f0', borderTop: '1px solid rgba(201,168,76,0.2)', borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 md:divide-x divide-[#C9A84C]/10">
            <div className="animate-on-scroll text-center px-4">
              <div className="flex flex-col items-center justify-center text-[#C9A84C] font-bold text-lg mb-1">
                ✦ No login needed
              </div>
              <div className="text-sm" style={{ color: darkMode ? 'var(--muted)' : '#9a8878' }}>Instant access</div>
            </div>
            <div className="animate-on-scroll stagger-1 text-center px-4">
              <div className="flex flex-col items-center justify-center text-[#C9A84C] font-bold text-lg mb-1">
                🔒 3 lock types
              </div>
              <div className="text-sm" style={{ color: darkMode ? 'var(--muted)' : '#9a8878' }}>Date, Password, Both</div>
            </div>
            <div className="animate-on-scroll stagger-2 text-center px-4">
              <div className="flex flex-col items-center justify-center text-[#C9A84C] font-bold text-lg mb-1">
                ⚡ Real-time sync
              </div>
              <div className="text-sm" style={{ color: darkMode ? 'var(--muted)' : '#9a8878' }}>Zero delay</div>
            </div>
            <div className="animate-on-scroll stagger-3 text-center px-4">
              <div className="flex flex-col items-center justify-center text-[#C9A84C] font-bold text-lg mb-1">
                🎨 Built-in whiteboard
              </div>
              <div className="text-sm" style={{ color: darkMode ? 'var(--muted)' : '#9a8878' }}>Draw together</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: Use Cases ──────────────────────────────── */}
      <section className="relative px-6 py-24 max-w-6xl mx-auto text-center">
        <h2 className="animate-on-scroll text-3xl md:text-4xl font-bold mb-16 bb-text">Made for moments that matter</h2>
        <div className="grid md:grid-cols-3 gap-8 text-left">
          <div className="animate-on-scroll glass-card rounded-2xl p-8 hover-lift group" style={{ backgroundColor: darkMode ? '#13132b' : '#fff8f0', border: darkMode ? '1px solid rgba(201,168,76,0.2)' : '1px solid rgba(201,168,76,0.3)', borderLeft: '3px solid #C9A84C' }}>
            <Gift className="text-[#ED93B1] w-10 h-10 mb-6 group-hover:scale-110 group-hover:-translate-y-1 transition-all" />
            <h3 className="text-xl font-bold mb-3" style={{ color: darkMode ? '#f5ecd7' : '#2a1f0e' }}>Birthdays</h3>
            <p className="leading-relaxed" style={{ color: darkMode ? '#8878a8' : '#9a8878' }}>Write something meaningful. Let it unlock at midnight on their special day.</p>
          </div>
          <div className="animate-on-scroll stagger-1 glass-card rounded-2xl p-8 hover-lift group" style={{ backgroundColor: darkMode ? '#13132b' : '#fff8f0', border: darkMode ? '1px solid rgba(201,168,76,0.2)' : '1px solid rgba(201,168,76,0.3)', borderLeft: '3px solid #C9A84C' }}>
            <PartyPopper className="text-[#AFA9EC] w-10 h-10 mb-6 group-hover:scale-110 group-hover:-translate-y-1 transition-all" />
            <h3 className="text-xl font-bold mb-3" style={{ color: darkMode ? '#f5ecd7' : '#2a1f0e' }}>Surprises</h3>
            <p className="leading-relaxed" style={{ color: darkMode ? '#8878a8' : '#9a8878' }}>Plan together after the big reveal. One link, one shared board.</p>
          </div>
          <div className="animate-on-scroll stagger-2 glass-card rounded-2xl p-8 hover-lift group" style={{ backgroundColor: darkMode ? '#13132b' : '#fff8f0', border: darkMode ? '1px solid rgba(201,168,76,0.2)' : '1px solid rgba(201,168,76,0.3)', borderLeft: '3px solid #C9A84C' }}>
            <GraduationCap className="text-[#ED93B1] w-10 h-10 mb-6 group-hover:scale-110 group-hover:-translate-y-1 transition-all" />
            <h3 className="text-xl font-bold mb-3" style={{ color: darkMode ? '#f5ecd7' : '#2a1f0e' }}>Milestones</h3>
            <p className="leading-relaxed" style={{ color: darkMode ? '#8878a8' : '#9a8878' }}>Lock a message for results day, graduation, or any moment worth waiting for.</p>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: CTA Banner ─────────────────────────────── */}
      <section className="relative px-6 py-24 mb-6">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[800px] h-[400px] rounded-[100%] bg-[rgba(201,168,76,0.08)] blur-[120px]" />
        </div>
        <div className="animate-on-scroll relative max-w-4xl mx-auto glass-card rounded-[2.5rem] p-12 md:p-16 text-center shadow-2xl" style={{ backgroundColor: darkMode ? '#0d0d1a' : '#fdf6ee' }}>
          <h2 className="text-3xl md:text-5xl font-bold mb-6" style={{ color: darkMode ? '#f5ecd7' : '#2a1f0e' }}>Ready to lock your first message?</h2>
          <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: darkMode ? '#8878a8' : '#9a8878' }}>Free forever. No account needed. Just a link.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/create')} 
              className="w-full sm:w-auto text-lg px-8 py-4 rounded-full font-bold transition-all duration-300"
              style={{ backgroundColor: '#C9A84C', color: '#0d0d1a' }}
            >
              ✨ Create a Board
            </button>
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
              className="w-full sm:w-auto px-8 py-4 rounded-full font-bold transition-all duration-300 bg-transparent hover:bg-[#C9A84C]/10"
              style={{ border: '2px solid #C9A84C', color: '#C9A84C' }}
            >
              See how it works
            </button>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: Footer ─────────────────────────────────── */}
      <footer className="relative border-t border-[#C9A84C]/20 pt-16 pb-8 px-6" style={{ backgroundColor: darkMode ? 'rgba(13,13,26,0.5)' : 'rgba(253,246,238,0.5)' }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12 mb-16">
          <div>
            <span className="text-2xl font-extrabold text-[#C9A84C] tracking-tight mb-4 inline-block select-none">
              ⬛ BlackBoard
            </span>
            <p className="max-w-xs mt-2" style={{ color: darkMode ? 'var(--muted)' : '#9a8878' }}>A digital vault for moments worth waiting for.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-6 uppercase tracking-wider text-sm" style={{ color: darkMode ? '#f5ecd7' : '#2a1f0e' }}>Links</h4>
            <ul className="space-y-3 text-sm font-medium" style={{ color: 'var(--nav-text)' }}>
              <li><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-[#C9A84C] transition-colors">Home</button></li>
              <li><button onClick={() => navigate('/create')} className="hover:text-[#C9A84C] transition-colors">Create Board</button></li>
              <li><button onClick={() => navigate('/whiteboard/new')} className="hover:text-[#C9A84C] transition-colors">Create Whiteboard</button></li>
              <li><button onClick={() => window.scrollTo({ top: document.body.scrollHeight/3, behavior: 'smooth' })} className="hover:text-[#C9A84C] transition-colors">How it works</button></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium mb-4" style={{ color: darkMode ? 'var(--muted)' : '#9a8878' }}>Built with 🖤 for special moments</p>
            <a href="/admin" className="text-[10px] text-[#8878a8]/30 hover:text-[#C9A84C] transition-colors uppercase tracking-widest">
              Admin Access
            </a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto text-center border-t border-[#C9A84C]/10 pt-8">
          <p className="text-xs" style={{ color: darkMode ? 'var(--muted)' : '#9a8878' }}>© {new Date().getFullYear()} BlackBoard. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
