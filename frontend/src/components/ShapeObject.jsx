import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Move, Maximize2, Trash2 } from 'lucide-react';

const SHAPE_COLORS = ['#C9A84C', '#ED93B1', '#AFA9EC', '#1D9E75', '#60a5fa', '#f97316'];

function ShapeSVG({ shapeType, width, height, strokeColor, fillColor, strokeWidth }) {
  const sw = strokeWidth || 2;
  const half = sw / 2;
  const w = Math.max(width, 10);
  const h = Math.max(height, 10);

  switch (shapeType) {
    case 'circle':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">
          <ellipse
            cx={w / 2} cy={h / 2}
            rx={w / 2 - half} ry={h / 2 - half}
            fill={fillColor || 'none'}
            stroke={strokeColor}
            strokeWidth={sw}
          />
        </svg>
      );
    case 'triangle': {
      const pts = `${w / 2},${half} ${w - half},${h - half} ${half},${h - half}`;
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">
          <polygon points={pts} fill={fillColor || 'none'} stroke={strokeColor} strokeWidth={sw} />
        </svg>
      );
    }
    case 'diamond': {
      const pts = `${w / 2},${half} ${w - half},${h / 2} ${w / 2},${h - half} ${half},${h / 2}`;
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">
          <polygon points={pts} fill={fillColor || 'none'} stroke={strokeColor} strokeWidth={sw} />
        </svg>
      );
    }
    case 'rect':
    default:
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">
          <rect
            x={half} y={half}
            width={w - sw} height={h - sw}
            rx={4}
            fill={fillColor || 'none'}
            stroke={strokeColor}
            strokeWidth={sw}
          />
        </svg>
      );
  }
}

export default function ShapeObject({ shape, updateShape, removeShape }) {
  const [isActive, setIsActive] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const wrapperRef = useRef(null);
  const dragRef = useRef(null);
  const lastEmitRef = useRef(0);
  const THROTTLE_MS = 80;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsActive(false);
        setShowColors(false);
      }
    };
    if (isActive) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActive]);

  const onPointerDown = useCallback((e, mode) => {
    e.stopPropagation();
    e.preventDefault();
    setIsActive(true);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startObjX: shape.x,
      startObjY: shape.y,
      startWidth: shape.width,
      startHeight: shape.height,
    };
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }, [shape]); // eslint-disable-line react-hooks/exhaustive-deps

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
        width: Math.max(24, startWidth + dx),
        height: Math.max(24, startHeight + dy),
      };
    }

    // Optimistic local update
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
      updateShape(shape.id, newProps, false);
      lastEmitRef.current = now;
    }
  }, [shape.id, updateShape]);

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
        width: Math.max(24, startWidth + dx),
        height: Math.max(24, startHeight + dy),
      };
    }

    updateShape(shape.id, newProps, true);
    dragRef.current = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }, [shape.id, updateShape, onPointerMove]);

  const strokeColor = shape.color || '#C9A84C';
  const fillColor = shape.fillColor || 'none';

  return (
    <div
      ref={wrapperRef}
      className={`absolute group select-none ${isActive ? 'z-50' : 'z-30'}`}
      data-wb-object="shape"
      style={{ left: shape.x, top: shape.y, width: shape.width, height: shape.height }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { if (!isActive) setIsHovered(false); }}
    >
      {/* SVG Shape */}
      <div
        className={`w-full h-full rounded ${isActive ? 'ring-2 ring-[#C9A84C] ring-offset-1 ring-offset-transparent' : ''}`}
        style={{ cursor: isActive ? 'move' : 'pointer' }}
        onPointerDown={(e) => onPointerDown(e, 'move')}
      >
        <ShapeSVG
          shapeType={shape.shapeType}
          width={shape.width}
          height={shape.height}
          strokeColor={strokeColor}
          fillColor={fillColor}
          strokeWidth={shape.strokeWidth || 2}
        />
      </div>

      {/* Hover edit hint */}
      {!isActive && isHovered && (
        <button
          onClick={(e) => { e.stopPropagation(); setIsActive(true); }}
          className="absolute -top-3 -right-3 w-7 h-7 bg-[var(--card)] border border-[#C9A84C]/50 rounded-full flex items-center justify-center shadow-lg text-[#C9A84C] hover:bg-[#C9A84C] hover:text-black transition-all text-xs font-bold"
        >
          ✎
        </button>
      )}

      {/* Active toolbar */}
      {isActive && (
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-[var(--card)] border border-[var(--input-border)] px-2 py-1.5 rounded-xl shadow-2xl flex items-center gap-1 z-50 whitespace-nowrap animate-slide-up">
          <button onPointerDown={(e) => onPointerDown(e, 'move')} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-colors" title="Move">
            <Move size={13} />
          </button>
          <button onPointerDown={(e) => onPointerDown(e, 'resize')} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 hover:text-[#C9A84C] transition-colors" title="Resize">
            <Maximize2 size={13} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          {/* Color picker */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowColors(v => !v); }}
            className="w-5 h-5 rounded-full border-2 border-white/30 transition-transform hover:scale-110"
            style={{ backgroundColor: strokeColor }}
            title="Color"
          />
          {showColors && (
            <div className="absolute top-9 left-1/2 -translate-x-1/2 bg-[var(--card)] border border-[var(--input-border)] px-2 py-1.5 rounded-xl shadow-2xl flex items-center gap-1.5 z-50">
              {SHAPE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={(e) => { e.stopPropagation(); updateShape(shape.id, { color: c }, true); setShowColors(false); }}
                  className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 ${strokeColor === c ? 'border-white scale-125' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button onClick={() => removeShape(shape.id)} className="p-1.5 rounded-lg text-[#ED93B1]/70 hover:bg-[#ED93B1]/10 hover:text-[#ED93B1] transition-colors" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Resize corner handle */}
      {isActive && (
        <div
          className="absolute -bottom-2 -right-2 w-5 h-5 bg-[var(--card)] border-2 border-[#C9A84C] rounded-full cursor-se-resize shadow-md hover:scale-110 transition-transform z-50"
          onPointerDown={(e) => onPointerDown(e, 'resize')}
        />
      )}
    </div>
  );
}
