import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import DOMPurify from 'dompurify';

const STICKY_COLORS = [
  { bg: '#fde68a', text: '#78350f', name: 'Yellow' },
  { bg: '#bbf7d0', text: '#14532d', name: 'Green' },
  { bg: '#fbcfe8', text: '#831843', name: 'Pink' },
  { bg: '#bfdbfe', text: '#1e3a5f', name: 'Blue' },
  { bg: '#ddd6fe', text: '#4c1d95', name: 'Purple' },
];

export default function StickyNote({ sticky, updateSticky, removeSticky }) {
  const [isActive, setIsActive] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef(null);
  const contentRef = useRef(null);
  const dragRef = useRef(null);
  const lastEmitRef = useRef(0);
  const THROTTLE_MS = 400;

  const colorDef = STICKY_COLORS.find(c => c.bg === sticky.color) || STICKY_COLORS[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsActive(false);
        // Save content on blur
        if (contentRef.current) {
          const cleanHTML = DOMPurify.sanitize(contentRef.current.innerHTML);
          updateSticky(sticky.id, { content: cleanHTML }, true);
          contentRef.current.blur();
        }
      }
    };
    if (isActive) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActive, sticky.id, updateSticky]);

  const onPointerDown = useCallback((e, mode) => {
    e.stopPropagation();
    if (mode === 'move') e.preventDefault();
    setIsActive(true);

    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startObjX: sticky.x,
      startObjY: sticky.y,
      startWidth: sticky.width || 240,
      startHeight: sticky.height || 180,
    };
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }, [sticky]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const { mode, startX, startY, startObjX, startObjY, startWidth, startHeight } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let newProps = {};

    if (mode === 'move') {
      newProps = { x: startObjX + dx, y: startObjY + dy };
    } else if (mode === 'resize') {
      newProps = {
        width: Math.max(120, startWidth + dx),
        height: Math.max(80, startHeight + dy),
      };
    }

    if (wrapperRef.current) {
      if (newProps.x !== undefined) {
        wrapperRef.current.style.left = `${newProps.x}px`;
        wrapperRef.current.style.top = `${newProps.y}px`;
      }
      if (newProps.width !== undefined) {
        wrapperRef.current.style.width = `${newProps.width}px`;
        wrapperRef.current.style.height = `${newProps.height}px`;
      }
    }

    const now = Date.now();
    if (now - lastEmitRef.current > THROTTLE_MS) {
      updateSticky(sticky.id, newProps, false);
      lastEmitRef.current = now;
    }
  }, [sticky.id, updateSticky]);

  const onPointerUp = useCallback((e) => {
    if (!dragRef.current) return;
    const { mode, startX, startY, startObjX, startObjY, startWidth, startHeight } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let newProps = {};

    if (mode === 'move') {
      newProps = { x: startObjX + dx, y: startObjY + dy };
    } else if (mode === 'resize') {
      newProps = {
        width: Math.max(120, startWidth + dx),
        height: Math.max(80, startHeight + dy),
      };
    }

    updateSticky(sticky.id, newProps, true);
    dragRef.current = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }, [sticky.id, updateSticky, onPointerMove]);

  const handleContentInput = () => {
    if (!contentRef.current) return;
    const now = Date.now();
    if (now - lastEmitRef.current > THROTTLE_MS) {
      const cleanHTML = DOMPurify.sanitize(contentRef.current.innerHTML);
      updateSticky(sticky.id, { content: cleanHTML }, false);
      lastEmitRef.current = now;
    }
  };

  const w = sticky.width || 240;
  const h = sticky.height || 180;

  return (
    <div
      ref={wrapperRef}
      className={`absolute group select-none ${isActive ? 'z-50' : 'z-30'}`}
      data-wb-object="sticky"
      style={{ left: sticky.x, top: sticky.y, width: w, height: h }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { if (!isActive) setIsHovered(false); }}
    >
      {/* Sticky card */}
      <div
        className="w-full h-full rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: colorDef.bg,
          boxShadow: isActive
            ? `0 8px 32px rgba(0,0,0,0.35), 0 0 0 2px #C9A84C`
            : `0 4px 16px rgba(0,0,0,0.25), 4px 4px 0 rgba(0,0,0,0.08)`,
          transform: isActive ? 'scale(1.02)' : 'scale(1)',
          transition: 'box-shadow 0.15s, transform 0.15s',
        }}
      >
        {/* Drag header strip */}
        <div
          className="flex items-center justify-between px-3 py-1.5 shrink-0 cursor-move"
          style={{ backgroundColor: `${colorDef.bg}dd` }}
          onPointerDown={(e) => onPointerDown(e, 'move')}
        >
          <span className="text-xs font-bold opacity-50 select-none" style={{ color: colorDef.text }}>
            ≡ drag
          </span>
          {(isActive || isHovered) && (
            <div className="flex items-center gap-1">
              {/* Color swatches */}
              {STICKY_COLORS.map(c => (
                <button
                  key={c.bg}
                  onClick={(e) => { e.stopPropagation(); updateSticky(sticky.id, { color: c.bg }, true); }}
                  className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-125 ${sticky.color === c.bg ? 'border-gray-600 scale-125' : 'border-transparent'}`}
                  style={{ backgroundColor: c.bg, filter: 'brightness(0.85)' }}
                  title={c.name}
                />
              ))}
              <div className="w-px h-3 bg-black/10 mx-0.5" />
              <button
                onClick={(e) => { e.stopPropagation(); removeSticky(sticky.id); }}
                className="p-0.5 rounded text-red-500/60 hover:text-red-600 hover:bg-red-100/50 transition-colors"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Content area */}
        <div
          ref={contentRef}
          contentEditable={isActive}
          suppressContentEditableWarning
          onInput={handleContentInput}
          dangerouslySetInnerHTML={{ __html: sticky.content || '' }}
          onClick={(e) => { e.stopPropagation(); setIsActive(true); }}
          className="flex-1 px-3 py-2 outline-none overflow-y-auto text-sm leading-relaxed break-words"
          style={{
            color: colorDef.text,
            cursor: isActive ? 'text' : 'default',
            fontFamily: "'Caveat', 'Patrick Hand', cursive, sans-serif",
            fontSize: '15px',
          }}
          placeholder="Add a note…"
        />

        {/* Placeholder text when empty and not active */}
        {!sticky.content && !isActive && (
          <div
            className="absolute bottom-4 left-3 text-sm opacity-40 pointer-events-none"
            style={{ color: colorDef.text, fontFamily: "'Caveat', cursive, sans-serif" }}
          >
            Click to add note…
          </div>
        )}
      </div>

      {/* Resize corner handle */}
      {isActive && (
        <div
          className="absolute -bottom-2 -right-2 w-5 h-5 bg-white/80 border-2 border-[#C9A84C] rounded-full cursor-se-resize shadow-md hover:scale-110 transition-transform z-50"
          onPointerDown={(e) => onPointerDown(e, 'resize')}
        />
      )}
    </div>
  );
}
