import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Move, Maximize2, Trash2, Edit2 } from 'lucide-react';

export default function ImageObject({ image, updateImage, removeImage, resolveImageSrc }) {
  const [isActive, setIsActive] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef(null);
  
  // Throttle updates
  const lastEmitRef = useRef(0);
  const THROTTLE_MS = 100;

  const dragRef = useRef(null);

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsActive(false);
      }
    };
    if (isActive) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActive]);

  const onPointerDown = (e, mode) => {
    e.stopPropagation();
    setIsActive(true);
    
    // Prevent default to avoid text selection during drag
    if (mode === 'move' || mode === 'resize') {
       e.preventDefault();
    }

    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startImgX: image.x,
      startImgY: image.y,
      startWidth: image.width,
      startHeight: image.height,
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const { mode, startX, startY, startImgX, startImgY, startWidth, startHeight } = dragRef.current;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newProps = {};

    if (mode === 'move') {
      newProps = { x: startImgX + dx, y: startImgY + dy };
    } else if (mode === 'resize') {
      // Maintain aspect ratio based on original width/height
      const ratio = startWidth / startHeight;
      // Use the larger delta to scale smoothly
      const maxDelta = Math.max(dx, dy);
      let newWidth = Math.max(60, startWidth + maxDelta);
      let newHeight = newWidth / ratio;
      newProps = { width: newWidth, height: newHeight };
    }

    const now = Date.now();
    if (now - lastEmitRef.current > THROTTLE_MS) {
      updateImage(image.id, newProps, false); // false = don't finalize yet (throttled sync)
      lastEmitRef.current = now;
    } else {
      // Local visual update only without triggering heavy socket syncs constantly
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
    }
  }, [image.id, updateImage]);

  const onPointerUp = useCallback((e) => {
    if (!dragRef.current) return;
    const { mode, startX, startY, startImgX, startImgY, startWidth, startHeight } = dragRef.current;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newProps = {};
    if (mode === 'move') {
      newProps = { x: startImgX + dx, y: startImgY + dy };
    } else if (mode === 'resize') {
      const ratio = startWidth / startHeight;
      const maxDelta = Math.max(dx, dy);
      let newWidth = Math.max(60, startWidth + maxDelta);
      newProps = { width: newWidth, height: newWidth / ratio };
    }

    // Final update with sync
    updateImage(image.id, newProps, true);
    
    dragRef.current = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }, [updateImage, image.id]);


  return (
    <div
      ref={wrapperRef}
      className={`absolute z-30 group ${isActive ? 'ring-2 ring-[#C9A84C]' : ''}`}
      style={{ left: image.x, top: image.y, width: image.width, height: image.height }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* The Image */}
      <img
        src={resolveImageSrc ? resolveImageSrc(image.src) : image.src}
        alt="Whiteboard Upload"
        className={`w-full h-full rounded shadow-lg select-none ${isActive ? 'opacity-100 cursor-move' : 'opacity-90'}`}
        onPointerDown={(e) => onPointerDown(e, 'move')}
        draggable={false}
      />

      {/* Hover Edit Icon */}
      {!isActive && isHovered && (
        <button
          onClick={(e) => { e.stopPropagation(); setIsActive(true); }}
          className="absolute -top-3 -right-3 w-8 h-8 bg-[var(--card)] border border-[#C9A84C]/50 rounded-full flex items-center justify-center shadow-lg text-[#C9A84C] hover:bg-[#C9A84C] hover:text-black transition-all"
        >
          <Edit2 size={14} />
        </button>
      )}

      {/* Active Context Menu */}
      {isActive && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[var(--card)] border border-[var(--input-border)] px-2 py-1.5 rounded-xl shadow-xl flex items-center gap-1 animate-slide-up">
          <button onPointerDown={(e) => onPointerDown(e, 'move')} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white" title="Move">
            <Move size={14} />
          </button>
          <button onPointerDown={(e) => onPointerDown(e, 'resize')} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 hover:text-[#C9A84C]" title="Resize">
            <Maximize2 size={14} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => removeImage(image.id)} className="p-1.5 rounded-lg text-[#ED93B1]/70 hover:bg-[#ED93B1]/10 hover:text-[#ED93B1]" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Resize Handle (Corner) */}
      {isActive && (
        <div
          className="absolute -bottom-2 -right-2 w-5 h-5 bg-[var(--card)] border-2 border-[#C9A84C] rounded-full cursor-se-resize shadow-md hover:scale-110 transition-transform"
          onPointerDown={(e) => onPointerDown(e, 'resize')}
        />
      )}
    </div>
  );
}
