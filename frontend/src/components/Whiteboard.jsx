import React, { useEffect, useRef, useState } from 'react';
import { Pen, Eraser, Trash2, Image as ImageIcon, Type, Undo2, Redo2, Square, StickyNote as StickyIcon, Circle, Triangle, Grid } from 'lucide-react';
import ImageObject from './ImageObject';
import TextObject from './TextObject';
import ShapeObject from './ShapeObject';
import StickyNote from './StickyNote';
import { useUserColor } from '../hooks/useUserColor';
import { RemoteCursor } from './whiteboard/RemoteCursor';
const API = process.env.REACT_APP_API_URL;

export default function Whiteboard({ boardId, socket, connected, userCount, displayName }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [ctx, setCtx] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#C9A84C');
  const [lineWidth, setLineWidth] = useState(3);
  const [toolType, setToolType] = useState('pen');
  const [textInput, setTextInput] = useState(null);
  const [images, setImages] = useState([]);
  const [strokes, setStrokes] = useState([]);

  // Shape tool state
  const [shapeType, setShapeType] = useState('rect');
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const [selectedFontSize, setSelectedFontSize] = useState(18);
  const [activeTextId, setActiveTextId] = useState(null);
  const [isDraftingShape, setIsDraftingShape] = useState(false);
  const [redoStack, setRedoStack] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [remoteCursors, setRemoteCursors] = useState({});
  const [gridType, setGridType] = useState('none'); // 'none' | 'dots' | 'lines'

  const { myColor, myNumber, myUserId } = useUserColor(socket);

  const currentStrokeRef = useRef(null);
  const liveStrokesRef = useRef({});
  const strokesRef = useRef([]);
  const shapeButtonRef = useRef(null);
  const shapeDraftRef = useRef(null);
  const imagesRef = useRef([]);
  const unpersistedStrokesRef = useRef([]);
  const lastCursorEmitRef = useRef(0);

  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  useEffect(() => { imagesRef.current = images; }, [images]);

  const palette = ['#C9A84C', '#ED93B1', '#AFA9EC', '#f5ecd7', '#000000', '#ffffff'];
  const resolveImageSrc = (src) => (typeof src === 'string' && src.startsWith('/uploads/') ? `${API}${src}` : src);

  const getCursor = () => {
    if (toolType === 'eraser') {
      const size = lineWidth * 2;
      const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${lineWidth}" cy="${lineWidth}" r="${lineWidth}" fill="rgba(255,255,255,0.5)" stroke="black" stroke-width="1"/></svg>`);
      return `url("data:image/svg+xml,${svg}") ${lineWidth} ${lineWidth}, auto`;
    }
    if (toolType === 'sticky') return 'cell';
    if (toolType === 'shape') return isDraftingShape ? 'crosshair' : 'crosshair';
    return 'crosshair';
  };

  const drawGhostShape = (draft) => {
    if (!ctx || !draft) return;
    renderAllStrokes();
    const { x, y, w, h } = draft;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 2;
    ctx.setLineDash([6, 4]);
    ctx.globalAlpha = 0.7;
    switch (shapeType) {
      case 'circle':
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'triangle': {
        const ax = x + w / 2, ay = y;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'diamond': {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w / 2, y + h);
        ctx.lineTo(x, y + h / 2);
        ctx.closePath();
        ctx.stroke();
        break;
      }
      default:
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.stroke();
    }
    ctx.restore();
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
        // Legacy support
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
    if (currentStrokeRef.current) {
      allStrokes.push(currentStrokeRef.current);
    }
    renderWhiteboard(ctx, allStrokes);
  };

  // When strokes change due to UNDO or other state updates, redraw all
  useEffect(() => {
    renderAllStrokes();
  }, [strokes, ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Setup Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = containerRef.current;
    const rect = parent.getBoundingClientRect();

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const context = canvas.getContext('2d');
    context.scale(dpr, dpr);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    setCtx(context);

    const handleResize = () => {
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

      // Redraw all strokes to avoid pixelation
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
      setRedoStack([]);
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

    const handleUserTypingUpdate = ({ userId, textBoxId, isTyping, userName, color }) => {
      setTypingUsers(prev => {
        if (!isTyping) {
          const next = { ...prev };
          delete next[textBoxId];
          return next;
        }
        return { ...prev, [textBoxId]: { userId, userName, color } };
      });
    };

    const handleReceiveTextContent = ({ objectId, content }) => {
      if (activeTextId !== objectId) {
        setImages(prev => prev.map(img => img.id === objectId ? { ...img, content } : img));
      }
    };

    const handleCursorMove = ({ userId, x, y, userName, color }) => {
      setRemoteCursors(prev => ({ ...prev, [userId]: { x, y, userName, color } }));
    };

    socket.on('receive_sync_stroke', handleReceiveSyncStroke);
    socket.on('receive_stroke', handleReceiveStroke);
    socket.on('receive_undo', () => setStrokes(prev => prev.slice(0, -1)));
    socket.on('clear_whiteboard', handleClear);
    socket.on('whiteboard_data', handleWhiteboardData);
    socket.on('whiteboard_image_added', handleImageAdded);
    socket.on('whiteboard_image_updated', handleImageUpdated);
    socket.on('whiteboard_image_removed', handleImageRemoved);
    socket.on('user_typing_update', handleUserTypingUpdate);
    socket.on('receive_text_content', handleReceiveTextContent);
    socket.on('cursor_move', handleCursorMove);

    return () => {
      socket.off('receive_sync_stroke', handleReceiveSyncStroke);
      socket.off('receive_stroke', handleReceiveStroke);
      socket.off('receive_undo');
      socket.off('clear_whiteboard', handleClear);
      socket.off('whiteboard_data', handleWhiteboardData);
      socket.off('whiteboard_image_added', handleImageAdded);
      socket.off('whiteboard_image_updated', handleImageUpdated);
      socket.off('whiteboard_image_removed', handleImageRemoved);
      socket.off('user_typing_update', handleUserTypingUpdate);
      socket.off('receive_text_content', handleReceiveTextContent);
      socket.off('cursor_move', handleCursorMove);
    };
  }, [socket, ctx, displayName, activeTextId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (e.target.closest && e.target.closest('[data-wb-object]')) return;
    e.preventDefault();
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    if (toolType === 'text') {
      if (textInput) submitText();
      setTextInput({ x, y, value: '' });
      return;
    }
    if (toolType === 'sticky') {
      if (textInput) submitText();
      const stickyObj = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        type: 'sticky',
        x, y,
        width: 240,
        height: 180,
        content: '',
        color: '#fde68a',
        userName: displayName.trim(),
      };
      setImages(prev => [...prev, stickyObj]);
      if (socket && socket.connected) socket.emit('whiteboard_image_added', { boardId, image: stickyObj });
      return;
    }
    if (toolType === 'shape') {
      if (textInput) submitText();
      shapeDraftRef.current = { x, y, w: 0, h: 0 };
      setIsDraftingShape(true);
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
    const textObj = {
      id: Date.now().toString(),
      type: 'text',
      x: textInput.x,
      y: textInput.y,
      content: textInput.value,
      color,
      size: lineWidth,
      fontSize: selectedFontSize,
      width: 200,
      height: 36,
      userName: displayName,
      authorName: displayName || localStorage.getItem('bb_user_name') || `User ${myNumber}`,
      authorColor: myColor,
      authorId: myUserId
    };
    setRedoStack([]);
    setImages(prev => [...prev, textObj]);
    if (socket && socket.connected) socket.emit('whiteboard_image_added', { boardId, image: textObj });
    setTextInput(null);
  };

  const draw = (e) => {
    e.preventDefault();
    const coords = getCoordinates(e);

    // Throttle cursor emit
    const now = Date.now();
    if (!lastCursorEmitRef.current || now - lastCursorEmitRef.current > 50) {
      if (socket && socket.connected) {
        socket.emit('cursor_move', { boardId, x: coords.x, y: coords.y, userName: displayName, color: myColor });
      }
      lastCursorEmitRef.current = now;
    }

    if (isDraftingShape && shapeDraftRef.current) {
      const anchor = shapeDraftRef.current;
      anchor.w = coords.x - anchor.x;
      anchor.h = coords.y - anchor.y;
      drawGhostShape(anchor);
      return;
    }
    if (!isDrawing || !ctx || !currentStrokeRef.current) return;
    
    currentStrokeRef.current.points.push({ x: coords.x, y: coords.y });
    renderAllStrokes();

    if (socket && socket.connected) socket.emit('draw_sync', { boardId, stroke: currentStrokeRef.current });
  };

  const stopDrawing = () => {
    // Commit shape draft
    if (isDraftingShape && shapeDraftRef.current) {
      const { x, y, w, h } = shapeDraftRef.current;
      const minSize = 10;
      if (Math.abs(w) > minSize && Math.abs(h) > minSize) {
        const shapeObj = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          type: 'shape',
          shapeType,
          x: w < 0 ? x + w : x,
          y: h < 0 ? y + h : y,
          width: Math.abs(w),
          height: Math.abs(h),
          color,
          fillColor: 'none',
          strokeWidth: lineWidth,
          userName: displayName.trim(),
        };
        setImages(prev => [...prev, shapeObj]);
        if (socket && socket.connected) socket.emit('whiteboard_image_added', { boardId, image: shapeObj });
      }
      shapeDraftRef.current = null;
      setIsDraftingShape(false);
      renderAllStrokes(); // clear ghost
      return;
    }

    if (!isDrawing) return;
    if (currentStrokeRef.current) {
      const finalStroke = currentStrokeRef.current;
      setStrokes(prev => [...prev, finalStroke]);
      if (socket && socket.connected) {
        // Track stroke as unpersisted until the server acknowledges it
        unpersistedStrokesRef.current = [...unpersistedStrokesRef.current, finalStroke];
        socket.emit('draw_stroke', { boardId, stroke: finalStroke }, () => {
          // Acknowledgement callback: remove from unpersisted list
          unpersistedStrokesRef.current = unpersistedStrokesRef.current.filter(
            s => s.id !== finalStroke.id
          );
        });
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
      const base64 = event.target.result;
      const imgData = {
        src: base64, x: 50, y: 50, width: 200, height: 200, id: Date.now().toString(), userName: displayName.trim()
      };
      setImages(prev => [...prev, imgData]);
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
    if (socket && socket.connected) socket.emit('whiteboard_image_removed', { boardId, imageId });
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 bottom-0 md:left-1/2 md:-translate-x-1/2 md:bottom-6 z-50 glass px-2 md:px-4 py-3 md:rounded-2xl flex items-center md:justify-center overflow-x-auto no-scrollbar shadow-[0_-10px_30px_rgba(0,0,0,0.1)] md:shadow-2xl border-t md:border border-white/10 w-full md:w-auto" style={{ backgroundColor: 'var(--wb-toolbar-bg)', borderColor: 'var(--wb-toolbar-border)' }}>
        <div className="flex items-center gap-1.5 md:gap-4 mx-auto min-w-max px-2">
          <div className="flex items-center gap-2 mr-2">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-[#1D9E75]' : 'bg-[#ED93B1]'} animate-pulse`} />
            <span className="text-sm font-medium bb-text hidden sm:inline">{connected ? 'Live' : 'Reconnecting…'}</span>
            <span className="text-xs bb-muted">{userCount} online</span>
          </div>

          <div className="flex items-center gap-2 border-r border-[#C9A84C]/20 pr-4">
            <button onClick={() => { setToolType('pen'); setActiveTextId(null); }} className={`p-1.5 rounded-lg transition-colors ${toolType === 'pen' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`} title="Pen"><Pen size={18} /></button>
            <button onClick={() => { setToolType('eraser'); setActiveTextId(null); }} className={`p-1.5 rounded-lg transition-colors ${toolType === 'eraser' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`} title="Eraser"><Eraser size={18} /></button>
            <button onClick={() => setToolType('text')} className={`p-1.5 rounded-lg transition-colors ${toolType === 'text' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`} title="Text"><Type size={18} /></button>
            <div className="relative">
              <button
                ref={shapeButtonRef}
                onClick={() => {
                  setToolType('shape');
                  setActiveTextId(null);
                  if (shapeButtonRef.current) {
                    const rect = shapeButtonRef.current.getBoundingClientRect();
                    setPickerPos({ top: rect.bottom + 6, left: rect.left });
                  }
                  setShowShapePicker(v => !v);
                }}
                className={`p-1.5 rounded-lg transition-colors ${toolType === 'shape' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`}
                title="Shapes"
              >
                <Square size={18} />
              </button>
              {showShapePicker && (
                <div className="absolute bg-[var(--card)] border border-[#C9A84C]/20 rounded-lg shadow-lg p-2 flex gap-1 z-50" style={{ top: `${pickerPos.top}px`, left: `${pickerPos.left}px` }}>
                  <button onClick={() => { setShapeType('rect'); setShowShapePicker(false); }} className={`p-2 rounded ${shapeType === 'rect' ? 'bg-[#C9A84C]/20' : 'hover:bg-gray-700/30'}`} title="Rectangle"><Square size={16} /></button>
                  <button onClick={() => { setShapeType('circle'); setShowShapePicker(false); }} className={`p-2 rounded ${shapeType === 'circle' ? 'bg-[#C9A84C]/20' : 'hover:bg-gray-700/30'}`} title="Circle"><Circle size={16} /></button>
                  <button onClick={() => { setShapeType('triangle'); setShowShapePicker(false); }} className={`p-2 rounded ${shapeType === 'triangle' ? 'bg-[#C9A84C]/20' : 'hover:bg-gray-700/30'}`} title="Triangle"><Triangle size={16} /></button>
                  <button onClick={() => { setShapeType('diamond'); setShowShapePicker(false); }} className={`p-2 rounded ${shapeType === 'diamond' ? 'bg-[#C9A84C]/20' : 'hover:bg-gray-700/30'}`} title="Diamond">◇</button>
                </div>
              )}
            </div>
            <button
              onClick={() => { setToolType('sticky'); setActiveTextId(null); }}
              className={`p-1.5 rounded-lg transition-colors ${toolType === 'sticky' ? 'bg-[#fde68a]/20 text-[#b45309]' : 'text-gray-400 hover:bg-gray-700/30'}`}
              title="Sticky Note"
            >
              <StickyIcon size={18} />
            </button>
            <input type="range" min="1" max="20" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} className="w-24 ml-2 accent-[#C9A84C]" title="Stroke width" />
            {toolType === 'text' && (
              <div className="flex items-center gap-1.5 ml-2 border-l border-[#C9A84C]/20 pl-2">
                <span className="text-xs text-gray-400 font-medium">Font Size:</span>
                <select
                  value={selectedFontSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setSelectedFontSize(newSize);
                    if (activeTextId) {
                      updateImage(activeTextId, { fontSize: newSize }, true);
                    }
                  }}
                  className="bg-[var(--card)] border border-[var(--input-border)] rounded-lg text-xs text-gray-300 px-2 py-1 outline-none cursor-pointer"
                >
                  <option value={14}>Small (14px)</option>
                  <option value={18}>Medium (18px)</option>
                  <option value={24}>Large (24px)</option>
                  <option value={32}>XL (32px)</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 border-r border-[#C9A84C]/20 pr-4 hidden md:flex">
            {palette.map(c => (
              <button key={c} onClick={() => { setColor(c); if (toolType === 'eraser') setToolType('pen'); }} className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c && toolType !== 'eraser' ? 'scale-125 border-gray-400' : 'border-transparent'}`} style={{ backgroundColor: c }} title={c} />
            ))}
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (toolType === 'eraser') setToolType('pen'); }} className="w-6 h-6 p-0 border-0 rounded cursor-pointer ml-1" />
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
            <div className="w-px h-6 bg-[#C9A84C]/20 mx-1 md:mx-2 hidden sm:block"></div>
            <button 
              onClick={() => setGridType(g => g === 'none' ? 'dots' : g === 'dots' ? 'lines' : 'none')}
              className={`p-1.5 rounded-lg transition-colors hidden sm:block ${gridType !== 'none' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`}
              title="Toggle Grid"
            >
              <Grid size={16} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden bg-[var(--bg)] cursor-crosshair ${gridType === 'dots' ? 'bg-dot-grid' : gridType === 'lines' ? 'bg-line-grid' : ''}`}
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
        {images.map((img) => {
          if (img.type === 'text') return (
            <TextObject
              key={img.id}
              textObj={img}
              updateText={updateImage}
              removeText={removeImage}
              activeTextId={activeTextId}
              setActiveTextId={setActiveTextId}
              socket={socket}
              myUserId={myUserId}
              typingUsers={typingUsers}
              boardId={boardId}
            />
          );
          if (img.type === 'shape') return (
            <ShapeObject
              key={img.id}
              shape={img}
              updateShape={updateImage}
              removeShape={removeImage}
            />
          );
          if (img.type === 'sticky') return (
            <StickyNote
              key={img.id}
              sticky={img}
              updateSticky={updateImage}
              removeSticky={removeImage}
            />
          );
          return (
            <ImageObject
              key={img.id}
              image={img}
              updateImage={updateImage}
              removeImage={removeImage}
              resolveImageSrc={resolveImageSrc}
            />
          );
        })}

        {/* Render Remote Cursors */}
        {Object.values(remoteCursors).map((c, i) => (
          <RemoteCursor key={`cursor-${i}`} x={c.x} y={c.y} color={c.color} userName={c.userName} />
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

        {/* Shape picker portal (fixed to escape toolbar overflow:hidden) */}
        {showShapePicker && (
          <div
            className="bg-[var(--card)] border border-[var(--input-border)] rounded-xl shadow-2xl p-2 flex gap-2 z-50"
            style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left }}
          >
            {[
              ['rect', 'Rect', <Square size={16} key="r" />],
              ['circle', 'Circle', <Circle size={16} key="c" />],
              ['triangle', 'Triangle', <Triangle size={16} key="t" />],
              ['diamond', 'Diamond', <span key="d" style={{ fontSize: '18px' }}>◇</span>],
            ].map(([st, label, icon]) => (
              <button
                key={st}
                onClick={() => { setShapeType(st); setShowShapePicker(false); }}
                className={`p-2 rounded-lg flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${shapeType === st ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`}
                title={label}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
