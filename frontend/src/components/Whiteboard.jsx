// src/components/Whiteboard.jsx
// Pure HTML5 Canvas Whiteboard with real-time sync and image support.
import React, { useEffect, useRef, useState } from 'react';
import { Pen, Eraser, Trash2, Image as ImageIcon, Type } from 'lucide-react';

export default function Whiteboard({ boardId, socket, connected, userCount }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [ctx, setCtx] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#C9A84C'); // default gold
  const [lineWidth, setLineWidth] = useState(3);
  const [toolType, setToolType] = useState('pen'); // 'pen', 'eraser', 'text'
  const [textInput, setTextInput] = useState(null);
  const [images, setImages] = useState([]); // stores whiteboard images
  
  // Real-time synchronization flags
  const lastPos = useRef({ x: 0, y: 0 });

  const palette = ['#C9A84C', '#ED93B1', '#AFA9EC', '#f5ecd7', '#000000', '#ffffff'];

  // ── Initialize canvas and context ───────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set high DPI for retina displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const context = canvas.getContext('2d');
    context.scale(dpr, dpr);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    setCtx(context);
    
    // Handle resize
    const handleResize = () => {
      const parent = containerRef.current;
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      const ctxNew = canvas.getContext('2d');
      ctxNew.scale(dpr, dpr);
      ctxNew.lineCap = 'round';
      ctxNew.lineJoin = 'round';
      ctxNew.drawImage(tempCanvas, 0, 0, tempCanvas.width / dpr, tempCanvas.height / dpr);
      setCtx(ctxNew);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Socket Events ──────────────────────────────────────────
  useEffect(() => {
    if (!socket || !ctx) return;

    const drawStrokeOnCanvas = (stroke) => {
      if (stroke.type === 'text') {
        ctx.font = `${stroke.lineWidth * 2 + 10}px Inter`;
        ctx.fillStyle = stroke.color;
        ctx.textBaseline = 'top';
        ctx.fillText(stroke.content, stroke.x, stroke.y);
        return;
      }
      ctx.beginPath();
      ctx.moveTo(stroke.startX, stroke.startY);
      ctx.lineTo(stroke.endX, stroke.endY);
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.globalCompositeOperation = stroke.isEraser ? 'destination-out' : 'source-over';
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; // reset
    };

    const handleReceiveStroke = (stroke) => {
      drawStrokeOnCanvas(stroke);
    };

    const handleClear = () => {
      const canvas = canvasRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setImages([]);
    };

    const handleWhiteboardData = (data) => {
      data.forEach(item => {
        if (item.type === 'stroke') {
          drawStrokeOnCanvas(item);
        } else if (item.type === 'image') {
          setImages(prev => [...prev, item]);
        }
      });
    };

    const handleImageAdded = (image) => {
      setImages(prev => [...prev, image]);
    };

    socket.on('receive_stroke', handleReceiveStroke);
    socket.on('clear_whiteboard', handleClear);
    socket.on('whiteboard_data', handleWhiteboardData);
    socket.on('whiteboard_image_added', handleImageAdded);

    return () => {
      socket.off('receive_stroke', handleReceiveStroke);
      socket.off('clear_whiteboard', handleClear);
      socket.off('whiteboard_data', handleWhiteboardData);
      socket.off('whiteboard_image_added', handleImageAdded);
    };
  }, [socket, ctx]);

  // ── Drawing Logic ──────────────────────────────────────────
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
    e.preventDefault(); // prevent scrolling on touch
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    
    if (toolType === 'text') {
      if (textInput) submitText();
      setTextInput({ x, y, value: '' });
      return;
    }
    
    if (textInput) submitText();
    setIsDrawing(true);
    lastPos.current = { x, y };
  };

  const submitText = () => {
    if (!textInput || !textInput.value.trim()) {
      setTextInput(null);
      return;
    }
    const stroke = {
      type: 'text',
      x: textInput.x,
      y: textInput.y,
      content: textInput.value,
      color: color,
      lineWidth: lineWidth
    };
    
    if (stroke.type === 'text') {
      ctx.font = `${stroke.lineWidth * 2 + 10}px Inter`;
      ctx.fillStyle = stroke.color;
      ctx.textBaseline = 'top';
      ctx.fillText(stroke.content, stroke.x, stroke.y);
    }
    
    if (socket && socket.connected) {
      socket.emit('draw_stroke', { boardId, stroke });
    }
    setTextInput(null);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing || !ctx) return;
    const { x, y } = getCoordinates(e);

    const stroke = {
      type: 'stroke',
      startX: lastPos.current.x,
      startY: lastPos.current.y,
      endX: x,
      endY: y,
      color: toolType === 'eraser' ? 'rgba(0,0,0,1)' : color,
      lineWidth,
      isEraser: toolType === 'eraser'
    };

    // Draw locally
    ctx.beginPath();
    ctx.moveTo(stroke.startX, stroke.startY);
    ctx.lineTo(stroke.endX, stroke.endY);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.globalCompositeOperation = stroke.isEraser ? 'destination-out' : 'source-over';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    // Emit over socket
    if (socket && socket.connected) {
      socket.emit('draw_stroke', { boardId, stroke });
    }

    lastPos.current = { x, y };
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!ctx) return;
    const canvas = canvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setImages([]);
    if (socket && socket.connected) {
      socket.emit('clear_whiteboard', { boardId });
    }
  };

  // ── Image Upload Handling ──────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      const imgData = {
        type: 'image',
        src: base64,
        x: 50,
        y: 50,
        width: 300,
        height: 300,
        id: Date.now()
      };
      setImages(prev => [...prev, imgData]);
      if (socket && socket.connected) {
        socket.emit('whiteboard_image_added', { boardId, image: imgData });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b overflow-x-auto" style={{ backgroundColor: 'var(--wb-toolbar-bg)', borderColor: 'var(--wb-toolbar-border)' }}>
        <div className="flex items-center gap-4 shrink-0">
          {/* Status */}
          <div className="flex items-center gap-2 mr-2">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-[#1D9E75]' : 'bg-[#ED93B1]'} animate-pulse`} />
            <span className="text-sm font-medium bb-text hidden sm:inline">
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
          </div>

          {/* Tools */}
          <div className="flex items-center gap-2 border-r border-[#C9A84C]/20 pr-4">
            <button
              onClick={() => setToolType('pen')}
              className={`p-1.5 rounded-lg transition-colors ${toolType === 'pen' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`}
              title="Pen"
            >
              <Pen size={18} />
            </button>
            <button
              onClick={() => setToolType('eraser')}
              className={`p-1.5 rounded-lg transition-colors ${toolType === 'eraser' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`}
              title="Eraser"
            >
              <Eraser size={18} />
            </button>
            <button
              onClick={() => setToolType('text')}
              className={`p-1.5 rounded-lg transition-colors ${toolType === 'text' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`}
              title="Text"
            >
              <Type size={18} />
            </button>
            
            <input 
              type="range" 
              min="1" max="20" 
              value={lineWidth} 
              onChange={e => setLineWidth(Number(e.target.value))}
              className="w-24 ml-2 accent-[#C9A84C]"
              title="Stroke width"
            />
          </div>

          {/* Colors */}
          <div className="flex items-center gap-1.5 border-r border-[#C9A84C]/20 pr-4 hidden md:flex">
            {palette.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); if (toolType === 'eraser') setToolType('pen'); }}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c && toolType !== 'eraser' ? 'scale-125 border-gray-400' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            <input 
              type="color" 
              value={color} 
              onChange={(e) => { setColor(e.target.value); if (toolType === 'eraser') setToolType('pen'); }}
              className="w-6 h-6 p-0 border-0 rounded cursor-pointer ml-1"
              title="Custom Color"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C]/20 text-sm font-medium text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all">
              <ImageIcon size={16} /> Image
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <button 
              onClick={clearCanvas}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ED93B1]/40 text-sm font-medium text-[#ED93B1] hover:bg-[#ED93B1]/10 transition-all"
            >
              <Trash2 size={16} /> Clear
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className="flex-1 relative overflow-hidden bg-[var(--bg)] cursor-crosshair"
      >
        {/* Render images underneath canvas drawing if we want them as layers, or simply render them as absolute DOM nodes. Let's render as DOM nodes under the canvas for now, with pointer events enabled for dragging later if needed, but for a pure canvas experience, we should draw them ON the canvas. Wait, DOM nodes are easier to drag/resize. Let's use DOM nodes that sit behind the canvas but let's make canvas pointer-events none? No, we draw on canvas. */}
        {images.map((img) => (
          <img 
            key={img.id}
            src={img.src} 
            alt="Whiteboard Upload"
            className="absolute rounded shadow-lg pointer-events-none opacity-90"
            style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
          />
        ))}

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full z-10 touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        
        {textInput && (
          <input
            type="text"
            autoFocus
            value={textInput.value}
            onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') submitText(); }}
            onBlur={submitText}
            style={{
              position: 'absolute',
              left: textInput.x,
              top: textInput.y,
              color: color,
              font: `${lineWidth * 2 + 10}px Inter`,
              background: 'transparent',
              border: '1px dashed #C9A84C',
              outline: 'none',
              zIndex: 30,
              minWidth: '100px',
              padding: '2px',
            }}
          />
        )}
      </div>
    </div>
  );
}
