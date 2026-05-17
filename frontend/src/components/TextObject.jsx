import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Move, Trash2, Edit2 } from 'lucide-react';
import DOMPurify from 'dompurify';

// ─── Caret helpers ────────────────────────────────────────────────────────────
const saveCaretPosition = (element) => {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
};

const restoreCaretPosition = (element, position) => {
  if (position === null || position === undefined) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let charCount = 0;
  let found = false;

  const traverse = (node) => {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const next = charCount + node.length;
      if (next >= position) {
        range.setStart(node, position - charCount);
        range.collapse(true);
        found = true;
      }
      charCount = next;
    } else {
      for (const child of node.childNodes) traverse(child);
    }
  };

  traverse(element);
  if (found) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
};
// ──────────────────────────────────────────────────────────────────────────────

export default function TextObject({ textObj, updateText, removeText, activeTextId, setActiveTextId }) {
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef(null);
  const contentRef = useRef(null);

  const lastEmitRef = useRef(0);
  const THROTTLE_MS = 500;
  const dragRef = useRef(null);

  const isActive = activeTextId === textObj.id;
  const setIsActive = (val) => {
    if (val) {
      setActiveTextId(textObj.id);
    } else {
      if (activeTextId === textObj.id) {
        setActiveTextId(null);
      }
    }
  };

  // ── Seed content ONCE on mount — never again via dangerouslySetInnerHTML ──
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.innerHTML = DOMPurify.sanitize(textObj.content || '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply remote content updates only when this box is NOT focused ─────────
  useEffect(() => {
    if (
      contentRef.current &&
      document.activeElement !== contentRef.current
    ) {
      contentRef.current.innerHTML = DOMPurify.sanitize(textObj.content || '');
    }
  }, [textObj.content]);

  // ── Recalculate height when font size changes ──────────────────────────────
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.height = 'auto';
      const newHeight = contentRef.current.scrollHeight;
      if (newHeight !== textObj.height) {
        updateText(textObj.id, { height: newHeight }, true);
      }
    }
  }, [textObj.fontSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Click-outside handler ─────────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        // Ignore toolbar / dropdown clicks so font-size select works
        if (
          e.target.closest &&
          (e.target.closest('[data-wb-toolbar]') ||
            e.target.closest('.whiteboard-toolbar') ||
            e.target.tagName === 'OPTION')
        ) {
          return;
        }
        setIsActive(false);
        if (contentRef.current) {
          contentRef.current.style.height = 'auto';
          const newHeight = contentRef.current.scrollHeight;
          const cleanHTML = DOMPurify.sanitize(contentRef.current.innerHTML);
          updateText(textObj.id, { content: cleanHTML, height: newHeight }, true);
          contentRef.current.blur();
        }
      }
    };
    if (isActive) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActive, textObj.id, updateText]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onPointerDown = (e, mode) => {
    e.stopPropagation();
    setIsActive(true);
    if (mode === 'move') e.preventDefault();
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
    } else if (wrapperRef.current) {
      wrapperRef.current.style.left = `${newProps.x}px`;
      wrapperRef.current.style.top = `${newProps.y}px`;
    }
  }, [textObj.id, updateText]);

  const onPointerUp = useCallback((e) => {
    if (!dragRef.current || dragRef.current.mode !== 'move') return;
    const { startX, startY, startObjX, startObjY } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    updateText(textObj.id, { x: startObjX + dx, y: startObjY + dy }, true);
    dragRef.current = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }, [updateText, textObj.id, onPointerMove]);

  // ── Input handler — NO state that controls innerHTML ──────────────────────
  const handleInput = () => {
    if (!contentRef.current) return;

    // Save caret BEFORE any DOM measurement (scrollHeight read is safe, but guard anyway)
    const caretPos = saveCaretPosition(contentRef.current);

    // Measure new height
    contentRef.current.style.height = 'auto';
    const newHeight = contentRef.current.scrollHeight;

    // Read content from DOM — never write it back
    const content = contentRef.current.innerText;

    const now = Date.now();
    if (now - lastEmitRef.current > THROTTLE_MS) {
      updateText(textObj.id, { content, height: newHeight }, false);
      lastEmitRef.current = now;
    } else {
      // Always persist height so border grows immediately
      updateText(textObj.id, { height: newHeight }, false);
    }

    // Restore caret after React has had a chance to flush
    requestAnimationFrame(() => {
      if (contentRef.current) {
        restoreCaretPosition(contentRef.current, caretPos);
      }
    });
  };

  return (
    <div
      ref={wrapperRef}
      className={`absolute z-40 group ${isActive ? 'ring-2 ring-[#C9A84C]' : ''}`}
      data-wb-object="text"
      style={{
        width: textObj.width || 200,
        height: textObj.height || 36,
        minHeight: 36,
        position: 'absolute',
        left: textObj.x,
        top: textObj.y,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Author Name Label */}
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          left: 0,
          fontSize: '10px',
          fontWeight: 600,
          fontFamily: 'Inter, sans-serif',
          background: '#ED93B1',
          color: '#0d0d1a',
          padding: '2px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 50,
        }}
      >
        {textObj.authorName || 'Anonymous'}
      </div>

      {/*
        ⚠️  NO dangerouslySetInnerHTML here — content is seeded once on mount
        via useEffect. React never touches innerHTML again, so the caret is
        never reset mid-keystroke.
      */}
      <div
        ref={contentRef}
        contentEditable={isActive}
        suppressContentEditableWarning
        onInput={handleInput}
        className="outline-none"
        style={{
          width: '100%',
          height: '100%',
          minHeight: 36,
          overflow: 'hidden',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          color: textObj.color,
          fontSize: (textObj.fontSize || 18) + 'px',
          fontFamily: 'Inter, sans-serif',
          cursor: isActive ? 'text' : 'pointer',
          background: isActive ? 'rgba(0,0,0,0.5)' : 'transparent',
          borderRadius: '4px',
          padding: '8px',
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
