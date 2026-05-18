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

  const animationFrameRef = useRef(null);
  const MIN_WIDTH = 120;
  const MIN_HEIGHT = 36;

  const clampBounds = (props) => {
    const parent = wrapperRef.current?.parentElement;
    if (!parent) return props;
    const parentRect = parent.getBoundingClientRect();
    const maxWidth = parentRect.width;
    const maxHeight = parentRect.height;

    let x = props.x;
    let y = props.y;
    let width = props.width;
    let height = props.height;

    if (width < MIN_WIDTH) width = MIN_WIDTH;
    if (height < MIN_HEIGHT) height = MIN_HEIGHT;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + width > maxWidth) x = Math.max(0, maxWidth - width);
    if (y + height > maxHeight) y = Math.max(0, maxHeight - height);

    return { x, y, width, height };
  };

  const applyWrapperStyle = (props) => {
    if (!wrapperRef.current) return;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(() => {
      wrapperRef.current.style.left = `${props.x}px`;
      wrapperRef.current.style.top = `${props.y}px`;
      wrapperRef.current.style.width = `${props.width}px`;
      wrapperRef.current.style.height = `${props.height}px`;
    });
  };

  const prepareResize = (e, handle) => {
    const width = textObj.width || 200;
    const height = textObj.height || 36;
    const aspectRatio = width / height;
    dragRef.current = {
      mode: 'resize',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startObjX: textObj.x,
      startObjY: textObj.y,
      startWidth: width,
      startHeight: height,
      aspectRatio,
    };
  };

  const calculateResize = useCallback((e) => {
    if (!dragRef.current || dragRef.current.mode !== 'resize') return null;
    const {
      startX,
      startY,
      startObjX,
      startObjY,
      startWidth,
      startHeight,
      aspectRatio,
      handle,
    } = dragRef.current;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let x = startObjX;
    let y = startObjY;
    let width = startWidth;
    let height = startHeight;
    const preserveWidthBased = Math.abs(dx) > Math.abs(dy);

    const applyRatio = (newWidth, newHeight) => {
      if (handle === 'top-left') {
        x = startObjX + (startWidth - newWidth);
        y = startObjY + (startHeight - newHeight);
      } else if (handle === 'top-right') {
        y = startObjY + (startHeight - newHeight);
      } else if (handle === 'bottom-left') {
        x = startObjX + (startWidth - newWidth);
      }
      width = newWidth;
      height = newHeight;
    };

    if (handle === 'bottom-right') {
      if (preserveWidthBased) {
        width = Math.max(MIN_WIDTH, startWidth + dx);
        height = Math.max(MIN_HEIGHT, width / aspectRatio);
      } else {
        height = Math.max(MIN_HEIGHT, startHeight + dy);
        width = Math.max(MIN_WIDTH, height * aspectRatio);
      }
      applyRatio(width, height);
    } else if (handle === 'top-left') {
      if (preserveWidthBased) {
        width = Math.max(MIN_WIDTH, startWidth - dx);
        height = Math.max(MIN_HEIGHT, width / aspectRatio);
      } else {
        height = Math.max(MIN_HEIGHT, startHeight - dy);
        width = Math.max(MIN_WIDTH, height * aspectRatio);
      }
      applyRatio(width, height);
    } else if (handle === 'top-right') {
      if (preserveWidthBased) {
        width = Math.max(MIN_WIDTH, startWidth + dx);
        height = Math.max(MIN_HEIGHT, width / aspectRatio);
      } else {
        height = Math.max(MIN_HEIGHT, startHeight - dy);
        width = Math.max(MIN_WIDTH, height * aspectRatio);
      }
      applyRatio(width, height);
    } else if (handle === 'bottom-left') {
      if (preserveWidthBased) {
        width = Math.max(MIN_WIDTH, startWidth - dx);
        height = Math.max(MIN_HEIGHT, width / aspectRatio);
      } else {
        height = Math.max(MIN_HEIGHT, startHeight + dy);
        width = Math.max(MIN_WIDTH, height * aspectRatio);
      }
      applyRatio(width, height);
    }

    return clampBounds({ x, y, width, height });
  }, []);

  const onPointerDown = (e, mode, handle) => {
    e.stopPropagation();
    setIsActive(true);
    if (mode === 'move' || mode === 'resize') e.preventDefault();

    if (mode === 'resize') {
      prepareResize(e, handle);
    } else {
      dragRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startObjX: textObj.x,
        startObjY: textObj.y,
      };
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const now = Date.now();

    if (dragRef.current.mode === 'move') {
      const { startX, startY, startObjX, startObjY } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const parent = wrapperRef.current?.parentElement;
      const x = Math.max(0, startObjX + dx);
      const y = Math.max(0, startObjY + dy);
      const bounds = parent ? parent.getBoundingClientRect() : null;
      const clampedX = bounds ? Math.min(x, bounds.width - (textObj.width || 200)) : x;
      const clampedY = bounds ? Math.min(y, bounds.height - (textObj.height || 36)) : y;
      const newProps = { x: clampedX, y: clampedY };

      if (now - lastEmitRef.current > 100) {
        updateText(textObj.id, newProps, false);
        lastEmitRef.current = now;
      } else if (wrapperRef.current) {
        wrapperRef.current.style.left = `${newProps.x}px`;
        wrapperRef.current.style.top = `${newProps.y}px`;
      }
      return;
    }

    if (dragRef.current.mode === 'resize') {
      const newProps = calculateResize(e);
      if (!newProps) return;
      applyWrapperStyle(newProps);
      if (now - lastEmitRef.current > 100) {
        updateText(textObj.id, newProps, false);
        lastEmitRef.current = now;
      }
    }
  }, [textObj.id, textObj.width, textObj.height, updateText, calculateResize]);

  const onPointerUp = useCallback((e) => {
    if (!dragRef.current) return;

    if (dragRef.current.mode === 'move') {
      const { startX, startY, startObjX, startObjY } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const parent = wrapperRef.current?.parentElement;
      const x = Math.max(0, startObjX + dx);
      const y = Math.max(0, startObjY + dy);
      const bounds = parent ? parent.getBoundingClientRect() : null;
      const clampedX = bounds ? Math.min(x, bounds.width - (textObj.width || 200)) : x;
      const clampedY = bounds ? Math.min(y, bounds.height - (textObj.height || 36)) : y;
      updateText(textObj.id, { x: clampedX, y: clampedY }, true);
    } else if (dragRef.current.mode === 'resize') {
      const newProps = calculateResize(e);
      if (newProps) {
        updateText(textObj.id, newProps, true);
      }
    }

    dragRef.current = null;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }, [textObj.id, textObj.width, textObj.height, updateText, onPointerMove, calculateResize]);

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

      {isActive && (
        <>
          <div
            onPointerDown={(e) => onPointerDown(e, 'resize', 'top-left')}
            className="absolute -top-2 -left-2 w-4 h-4 bg-[var(--card)] border border-[#C9A84C] rounded-full cursor-nwse-resize z-50"
          />
          <div
            onPointerDown={(e) => onPointerDown(e, 'resize', 'top-right')}
            className="absolute -top-2 -right-2 w-4 h-4 bg-[var(--card)] border border-[#C9A84C] rounded-full cursor-nesw-resize z-50"
          />
          <div
            onPointerDown={(e) => onPointerDown(e, 'resize', 'bottom-left')}
            className="absolute -bottom-2 -left-2 w-4 h-4 bg-[var(--card)] border border-[#C9A84C] rounded-full cursor-nesw-resize z-50"
          />
          <div
            onPointerDown={(e) => onPointerDown(e, 'resize', 'bottom-right')}
            className="absolute -bottom-2 -right-2 w-4 h-4 bg-[var(--card)] border border-[#C9A84C] rounded-full cursor-nwse-resize z-50"
          />
        </>
      )}

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
