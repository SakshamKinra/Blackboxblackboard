import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Move, Trash2, Edit2 } from 'lucide-react';
import DOMPurify from 'dompurify';

export default function TextObject({ textObj, updateText, removeText }) {
  const [isActive, setIsActive] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef(null);
  const contentRef = useRef(null);

  const lastEmitRef = useRef(0);
  const THROTTLE_MS = 500; // text updates can be throttled more to prevent input lag
  const dragRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsActive(false);
        if (contentRef.current) {
           const cleanHTML = DOMPurify.sanitize(contentRef.current.innerHTML);
           updateText(textObj.id, { content: cleanHTML }, true);
           contentRef.current.blur();
        }
      }
    };
    if (isActive) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActive, textObj.id, updateText]);

  const onPointerDown = (e, mode) => {
    e.stopPropagation();
    setIsActive(true);
    if (mode === 'move') {
      e.preventDefault();
    }
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startObjX: textObj.x,
      startObjY: textObj.y,
    };
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current || dragRef.current.mode !== 'move') return;
    const { startX, startY, startObjX, startObjY } = dragRef.current;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newProps = { x: startObjX + dx, y: startObjY + dy };

    const now = Date.now();
    if (now - lastEmitRef.current > 100) {
      updateText(textObj.id, newProps, false);
      lastEmitRef.current = now;
    } else {
      if (wrapperRef.current) {
        wrapperRef.current.style.left = `${newProps.x}px`;
        wrapperRef.current.style.top = `${newProps.y}px`;
      }
    }
  }, [textObj.id, updateText]);

  const onPointerUp = useCallback((e) => {
    if (!dragRef.current || dragRef.current.mode !== 'move') return;
    const { startX, startY, startObjX, startObjY } = dragRef.current;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newProps = { x: startObjX + dx, y: startObjY + dy };

    updateText(textObj.id, newProps, true);
    dragRef.current = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }, [updateText, textObj.id]);

  const handleInput = () => {
    if (!contentRef.current) return;
    const now = Date.now();
    if (now - lastEmitRef.current > THROTTLE_MS) {
       const cleanHTML = DOMPurify.sanitize(contentRef.current.innerHTML);
       updateText(textObj.id, { content: cleanHTML }, false); // silent sync
       lastEmitRef.current = now;
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={`absolute z-40 group ${isActive ? 'ring-2 ring-[#C9A84C]' : ''}`}
      style={{ left: textObj.x, top: textObj.y }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={contentRef}
        contentEditable={isActive}
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: textObj.content || 'Text' }}
        className={`min-w-[50px] min-h-[30px] p-2 outline-none whitespace-pre-wrap break-words`}
        style={{ 
          color: textObj.color, 
          font: `${(textObj.size || textObj.lineWidth || 10) * 2 + 10}px Inter`,
          cursor: isActive ? 'text' : 'pointer',
          background: isActive ? 'rgba(0,0,0,0.5)' : 'transparent',
          borderRadius: '4px'
        }}
        onPointerDown={(e) => {
          if (!isActive) {
             onPointerDown(e, 'move');
          } else {
             e.stopPropagation();
          }
        }}
      />

      {!isActive && isHovered && (
        <button
          onClick={(e) => { e.stopPropagation(); setIsActive(true); }}
          className="absolute -top-3 -right-3 w-6 h-6 bg-[var(--card)] border border-[#C9A84C]/50 rounded-full flex items-center justify-center shadow-lg text-[#C9A84C] hover:bg-[#C9A84C] hover:text-black transition-all"
        >
          <Edit2 size={12} />
        </button>
      )}

      {isActive && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[var(--card)] border border-[var(--input-border)] px-2 py-1.5 rounded-xl shadow-xl flex items-center gap-1 animate-slide-up">
          <button onPointerDown={(e) => onPointerDown(e, 'move')} className="p-1 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white" title="Move">
            <Move size={14} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => removeText(textObj.id)} className="p-1 rounded-lg text-[#ED93B1]/70 hover:bg-[#ED93B1]/10 hover:text-[#ED93B1]" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
