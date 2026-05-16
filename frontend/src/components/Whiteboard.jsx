import React, { useEffect, useRef, useState } from 'react';
import { Pen, Eraser, Trash2, Image as ImageIcon, Type, Undo2, Redo2 } from 'lucide-react';
import ImageObject from './ImageObject';
import TextObject from './TextObject';
const API = process.env.REACT_APP_API_URL;

export default function Whiteboard({ boardId, socket, connected, userCount, displayName }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [ctx, setCtx] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#C9A84C');
  const [lineWidth, setLineWidth] = useState(3);
  const [toolType, setToolType] = useState('pen');
  const [textInput, setTextInput] = useState(null);
  const [images, setImages] = useState([]);
  const [activeImageId, setActiveImageId] = useState(null);

  const [strokes, setStrokes] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const strokesRef = useRef([]);
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  const liveStrokesRef = useRef({});
  const currentStrokeRef = useRef(null);

  const lastPos = useRef({ x: 0, y: 0 });
  const palette = ['#C9A84C', '#ED93B1', '#AFA9EC', '#f5ecd7', '#000000', '#ffffff'];
  const resolveImageSrc = (src) => (typeof src === 'string' && src.startsWith('/uploads/') ? `${API}${src}` : src);

  const getCursor = () => {
    if (toolType === 'eraser') {
      const size = lineWidth * 2;
      const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${lineWidth}" cy="${lineWidth}" r="${lineWidth}" fill="rgba(255,255,255,0.5)" stroke="black" stroke-width="1"/></svg>`);
      return `url("data:image/svg+xml,${svg}") ${lineWidth} ${lineWidth}, auto`;
    }
    return 'crosshair';
  };

  const renderWhiteboard = (context, strokesList) => {
    if (!context) return;
    const canvas = context.canvas;
    context.clearRect(0, 0, canvas.width, canvas.height);
    strokesList.forEach(stroke => {
      if (!stroke) return;
      if (stroke.type === 'text') {
        context.font = `${(stroke.size || stroke.lineWidth) * 2 + 10}px Inter`;
        context.fillStyle = stroke.color;
        context.textBaseline = 'top';
        context.fillText(stroke.content, stroke.x, stroke.y);
        return;
      }
      if (stroke.type === 'path' && stroke.points && stroke.points.length > 0) {
        context.beginPath();
        context.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          context.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        context.strokeStyle = stroke.color;
        context.lineWidth = stroke.size || stroke.lineWidth;
        context.globalCompositeOperation = stroke.tool === 'eraser' || stroke.isEraser ? 'destination-out' : 'source-over';
        context.stroke();
        context.globalCompositeOperation = 'source-over';
      } else if (stroke.startX !== undefined) {
        context.beginPath();
        context.moveTo(stroke.startX, stroke.startY);
        context.lineTo(stroke.endX, stroke.endY);
        context.strokeStyle = stroke.color;
        context.lineWidth = stroke.lineWidth || stroke.size;
        context.globalCompositeOperation = stroke.isEraser ? 'destination-out' : 'source-over';
        context.stroke();
        context.globalCompositeOperation = 'source-over';
      }
    });
  };

  const renderAllStrokes = () => {
    if (!ctx) return;
    const allStrokes = [...strokesRef.current, ...Object.values(liveStrokesRef.current)];
    if (currentStrokeRef.current) allStrokes.push(currentStrokeRef.current);
    renderWhiteboard(ctx, allStrokes);
  };

  useEffect(() => { renderAllStrokes(); }, [strokes, ctx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const context = canvas.getContext('2d');
    context.scale(dpr, dpr);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    setCtx(context);

    const handleResize = () => {
      const parent = containerRef.current;
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      const ctxNew = canvas.getContext('2d');
      ctxNew.scale(dpr, dpr);
      ctxNew.lineCap = 'round';
      ctxNew.lineJoin = 'round';
      renderWhiteboard(ctxNew, [...strokesRef.current, ...Object.values(liveStrokesRef.current)]);
      setCtx(ctxNew);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activities, setActivities] = useState([]);

  const addActivity = (userName, action) => {
    setActivities(prev => [{ userName, action, id: Date.now(), timestamp: new Date() }, ...prev].slice(0, 5));
  };

  useEffect(() => {
    if (!socket || !ctx) return;

    const handleReceiveSyncStroke = (stroke) => {
      liveStrokesRef.current[stroke.id] = stroke;
      renderAllStrokes();
    };

    const handleReceiveStroke = (stroke) => {
      setStrokes(prev => [...prev, stroke]);
      delete liveStrokesRef.current[stroke.id];
      if (stroke.userName && stroke.userName !== displayName) {
        addActivity(stroke.userName, stroke.tool === 'eraser' || stroke.isEraser ? 'erased' : 'drew');
      }
    };

    const handleClear = () => {
      setStrokes([]);
      setImages([]);
      liveStrokesRef.current = {};
      currentStrokeRef.current = null;
      addActivity('Someone', 'cleared the board');
    };

    const handleWhiteboardData = (data) => {
      setImages([]);
      const imageItems = [];
      const strokeItems = [];
      data.forEach((item) => {
        if (item.type === 'image') imageItems.push(item);
        else strokeItems.push(item);
      });
      if (imageItems.length > 0) setImages(imageItems);
      setStrokes(strokeItems);
    };

    const handleImageAdded = (image) => {
      setImages((prev) => [...prev.filter((img) => img.id !== image.id), image]);
      if (image.userName && image.userName !== displayName) {
        addActivity(image.userName, 'added an image');
      }
    };

    const handleImageUpdated = (image) => {
      setImages((prev) => prev.map((img) => (img.id === image.id ? { ...img, ...image } : img)));
    };

    const handleImageRemoved = ({ imageId }) => {
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    };

    socket.on('receive_sync_stroke', handleReceiveSyncStroke);
    socket.on('receive_stroke', handleReceiveStroke);
    socket.on('receive_undo', () => setStrokes(prev => prev.slice(0, -1)));
    socket.on('clear_whiteboard', handleClear);
    socket.on('whiteboard_data', handleWhiteboardData);
    socket.on('whiteboard_image_added', handleImageAdded);
    socket.on('whiteboard_image_updated', handleImageUpdated);
    socket.on('whiteboard_image_removed', handleImageRemoved);

    return () => {
      socket.off('receive_sync_stroke', handleReceiveSyncStroke);
      socket.off('receive_stroke', handleReceiveStroke);
      socket.off('receive_undo');
      socket.off('clear_whiteboard', handleClear);
      socket.off('whiteboard_data', handleWhiteboardData);
      socket.off('whiteboard_image_added', handleImageAdded);
      socket.off('whiteboard_image_updated', handleImageUpdated);
      socket.off('whiteboard_image_removed', handleImageRemoved);
    };
  }, [socket, ctx, displayName]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
    e.preventDefault();
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    if (toolType === 'text') {
      if (textInput) submitText();
      setTextInput({ x, y, value: '' });
      return;
    }
    if (textInput) submitText();
    
    setRedoStack([]);
    currentStrokeRef.current = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      type: 'path',
      tool: toolType,
      color: toolType === 'eraser' ? 'rgba(0,0,0,1)' : color,
      size: lineWidth,
      points: [{ x, y }],
      userName: displayName,
    };
    setIsDrawing(true);
    renderAllStrokes();
  };

  const submitText = () => {
    if (!textInput || !textInput.value.trim()) {
      setTextInput(null);
      return;
    }
    const textObj = { id: Date.now().toString(), type: 'text', x: textInput.x, y: textInput.y, content: textInput.value, color, size: lineWidth, userName: displayName };
    setRedoStack([]);
    setImages(prev => [...prev, textObj]);
    if (socket && socket.connected) socket.emit('whiteboard_image_added', { boardId, image: textObj });
    setTextInput(null);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing || !ctx || !currentStrokeRef.current) return;
    const { x, y } = getCoordinates(e);
    
    currentStrokeRef.current.points.push({ x, y });
    renderAllStrokes();

    if (socket && socket.connected) socket.emit('draw_sync', { boardId, stroke: currentStrokeRef.current });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    if (currentStrokeRef.current) {
      const finalStroke = currentStrokeRef.current;
      setStrokes(prev => [...prev, finalStroke]);
      if (socket && socket.connected) {
        socket.emit('draw_stroke', { boardId, stroke: finalStroke });
      }
      currentStrokeRef.current = null;
    }
    setIsDrawing(false);
  };

  const undoStroke = () => {
    if (strokes.length === 0) return;
    const lastStroke = strokes[strokes.length - 1];
    setStrokes(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastStroke]);
    if (socket && socket.connected) socket.emit('draw_undo', { boardId });
  };

  const redoStroke = () => {
    if (redoStack.length === 0) return;
    const stroke = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setStrokes(prev => [...prev, stroke]);
    if (socket && socket.connected) socket.emit('draw_stroke', { boardId, stroke });
  };

  const clearCanvas = () => {
    if (!ctx) return;
    setStrokes([]);
    setRedoStack([]);
    setImages([]);
    if (socket && socket.connected) socket.emit('clear_whiteboard', { boardId });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const imgData = { type: 'image', src: event.target.result, x: 50, y: 50, width: 300, height: 200, id: Date.now().toString(), userName: displayName };
      setImages((prev) => [...prev, imgData]);
      if (socket && socket.connected) socket.emit('whiteboard_image_added', { boardId, image: imgData });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const updateImage = (id, newProps, sync = true) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...newProps } : img));
    if (sync && socket && socket.connected) {
      const updated = { id, ...newProps, userName: displayName };
      socket.emit('whiteboard_image_updated', { boardId, image: updated });
    }
  };

  const removeImage = (imageId) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    setActiveImageId(null);
    if (socket && socket.connected) socket.emit('whiteboard_image_removed', { boardId, imageId });
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b overflow-x-auto" style={{ backgroundColor: 'var(--wb-toolbar-bg)', borderColor: 'var(--wb-toolbar-border)' }}>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 mr-2">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-[#1D9E75]' : 'bg-[#ED93B1]'} animate-pulse`} />
            <span className="text-sm font-medium bb-text hidden sm:inline">{connected ? 'Live' : 'Reconnecting…'}</span>
            <span className="text-xs bb-muted">{userCount} online</span>
          </div>

          <div className="flex items-center gap-2 border-r border-[#C9A84C]/20 pr-4">
            <button onClick={() => setToolType('pen')} className={`p-1.5 rounded-lg transition-colors ${toolType === 'pen' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`} title="Pen"><Pen size={18} /></button>
            <button onClick={() => setToolType('eraser')} className={`p-1.5 rounded-lg transition-colors ${toolType === 'eraser' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`} title="Eraser"><Eraser size={18} /></button>
            <button onClick={() => setToolType('text')} className={`p-1.5 rounded-lg transition-colors ${toolType === 'text' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`} title="Text"><Type size={18} /></button>
            <input type="range" min="1" max="20" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} className="w-24 ml-2 accent-[#C9A84C]" title="Stroke width" />
          </div>

          <div className="flex items-center gap-1.5 border-r border-[#C9A84C]/20 pr-4 hidden md:flex">
            {palette.map(c => (
              <button key={c} onClick={() => { setColor(c); if (toolType === 'eraser') setToolType('pen'); }} className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c && toolType !== 'eraser' ? 'scale-125 border-gray-400' : 'border-transparent'}`} style={{ backgroundColor: c }} title={c} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={undoStroke} disabled={strokes.length === 0} className={`p-1.5 rounded-lg transition-colors ${strokes.length === 0 ? 'text-gray-600' : 'text-gray-400 hover:bg-gray-700/30'}`} title="Undo">
              <Undo2 size={16} />
            </button>
            <button onClick={redoStroke} disabled={redoStack.length === 0} className={`p-1.5 rounded-lg transition-colors ${redoStack.length === 0 ? 'text-gray-600' : 'text-gray-400 hover:bg-gray-700/30'}`} title="Redo">
              <Redo2 size={16} />
            </button>
            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C]/20 text-sm font-medium text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all">
              <ImageIcon size={16} /> Image
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <button onClick={clearCanvas} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ED93B1]/40 text-sm font-medium text-[#ED93B1] hover:bg-[#ED93B1]/10 transition-all">
              <Trash2 size={16} /> Clear
            </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-[var(--bg)] cursor-crosshair"
      >
        {/* Activity Feed Overlay */}
        <div className="absolute top-4 left-4 z-40 pointer-events-none flex flex-col gap-2">
          {activities.map((act) => (
            <div key={act.id} className="bg-[var(--card)]/80 backdrop-blur-sm border border-[#C9A84C]/20 px-3 py-1.5 rounded-lg shadow-sm animate-fade-in flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]"></span>
               <span className="text-[10px] font-bold text-[#C9A84C] whitespace-nowrap">{act.userName}</span>
               <span className="text-[10px] bb-text opacity-70 whitespace-nowrap">{act.action}</span>
            </div>
          ))}
        </div>
        {images.map((img) => (
          img.type === 'text' ? (
            <TextObject
              key={img.id}
              textObj={img}
              updateText={updateImage}
              removeText={removeImage}
            />
          ) : (
            <ImageObject
              key={img.id}
              image={img}
              updateImage={updateImage}
              removeImage={removeImage}
              resolveImageSrc={resolveImageSrc}
            />
          )
        ))}

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full z-10 touch-none"
          style={{ cursor: getCursor() }}
          onContextMenu={(e) => e.preventDefault()}
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
            style={{ position: 'absolute', left: textInput.x, top: textInput.y, color, font: `${lineWidth * 2 + 10}px Inter`, background: 'transparent', border: '1px dashed #C9A84C', outline: 'none', zIndex: 30, minWidth: '100px', padding: '2px' }}
          />
        )}
      </div>
    </div>
  );
}
