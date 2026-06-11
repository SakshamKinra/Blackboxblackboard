import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Plus, Moon, Sun, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function CommandPalette({ darkMode, toggleTheme }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();

  const actions = [
    { id: 'home', label: 'Go to Home', icon: <Home size={16} />, onSelect: () => navigate('/') },
    { id: 'new_board', label: 'Create New Board', icon: <Plus size={16} />, onSelect: () => navigate('/new') },
    { id: 'toggle_theme', label: `Toggle ${darkMode ? 'Light' : 'Dark'} Mode`, icon: darkMode ? <Sun size={16} /> : <Moon size={16} />, onSelect: toggleTheme },
    { id: 'help', label: 'Help / About', icon: <HelpCircle size={16} />, onSelect: () => toast('BlackBoard is a collaborative workspace.') },
  ];

  const filteredActions = actions.filter(action => 
    action.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (action) => {
    action.onSelect();
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm px-4" onClick={() => setIsOpen(false)}>
      <div 
        className="w-full max-w-lg bg-[var(--card)] border border-[#C9A84C]/20 rounded-xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-[#C9A84C]/10">
          <Search size={20} className="text-gray-400 mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search..."
            className="w-full bg-transparent border-none outline-none text-[var(--text)] text-lg placeholder:text-gray-500"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(i => (i + 1) % filteredActions.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(i => (i - 1 + filteredActions.length) % filteredActions.length);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredActions[activeIndex]) handleSelect(filteredActions[activeIndex]);
              }
            }}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredActions.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">No commands found.</div>
          ) : (
            filteredActions.map((action, index) => (
              <button
                key={action.id}
                onClick={() => handleSelect(action)}
                className={`w-full flex items-center px-3 py-3 rounded-lg text-sm transition-colors ${
                  index === activeIndex ? 'bg-[#C9A84C]/10 text-[#C9A84C]' : 'text-gray-300 hover:bg-white/5'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="mr-3 text-gray-400">{action.icon}</span>
                {action.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
