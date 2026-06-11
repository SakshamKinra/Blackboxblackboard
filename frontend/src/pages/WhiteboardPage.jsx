// src/pages/WhiteboardPage.jsx
// Full Standalone Whiteboard with shareable link and real-time sync.
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Pen, Eraser, Trash2, Maximize, Download, Image as ImageIcon, Type, Undo2, Redo2, Square, StickyNote as StickyIcon, Circle, Triangle, Share2, Grid } from 'lucide-react';
import ImageObject from '../components/ImageObject';
import TextObject from '../components/TextObject';
import ShapeObject from '../components/ShapeObject';
import StickyNote from '../components/StickyNote';
import { useUserColor } from '../hooks/useUserColor';
import { AvatarBar } from '../components/shared/AvatarBar';
import { RemoteCursor } from '../components/whiteboard/RemoteCursor';
import { ShareModal } from '../components/shared/ShareModal';

const API = process.env.REACT_APP_API_URL;
const SOCKET_URL = process.env.REACT_APP_API_URL;

export default function WhiteboardPage({ darkMode, toggleTheme }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [ctx, setCtx] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Whiteboard State
  const [title, setTitle] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#C9A84C');
  const [lineWidth, setLineWidth] = useState(3);
  const [toolType, setToolType] = useState('pen'); // 'pen', 'eraser', 'text', 'shape', 'sticky'
  const [textInput, setTextInput] = useState(null);
  const [images, setImages] = useState([]);
  const [strokes, setStrokes] = useState([]);

  // Shape tool state
  const [shapeType, setShapeType] = useState('rect'); // rect | circle | triangle | diamond
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const shapeButtonRef = useRef(null);
  const shapeDraftRef = useRef(null); // { x, y, w, h } during drag
  const [isDraftingShape, setIsDraftingShape] = useState(false);
  const [selectedFontSize, setSelectedFontSize] = useState(18); // Default: Medium (18px)
  const [activeTextId, setActiveTextId] = useState(null);
  const imagesRef = useRef([]);
  useEffect(() => { imagesRef.current = images; }, [images]);

  const [displayName, setDisplayName] = useState('');
  const [joined, setJoined] = useState(false);

  const currentStrokeRef = useRef(null);
  const liveStrokesRef = useRef({});
  const strokesRef = useRef([]);
  const socketRef = useRef(null);          // mirror of socket state for beforeunload
  const unpersistedStrokesRef = useRef([]); // strokes emitted but not yet flushed to DB
  const [redoStack, setRedoStack] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [remoteCursors, setRemoteCursors] = useState({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [gridType, setGridType] = useState('none'); // 'none' | 'dots' | 'lines'
  const lastCursorEmitRef = useRef(0);

  const { myColor, myNumber, myUserId, activeUsers } = useUserColor(socket);

  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  useEffect(() => { socketRef.current = socket; }, [socket]);

  const palette = ['#C9A84C', '#ED93B1', '#AFA9EC', '#f5ecd7', '#000000'];

  useEffect(() => {
    const savedName = sessionStorage.getItem(`wb-name:${id}`) || '';
    if (savedName.trim()) {
      setDisplayName(savedName);
      setJoined(true);
    }
  }, [id]);

  // Fetch initial data & setup socket
  useEffect(() => {
    if (!joined || !displayName.trim()) return undefined;
    let newSocket;

    async function init() {
      try {
        const { data } = await axios.get(`${API}/api/whiteboards/${id}`);
        if (data.success) {
          setTitle(data.whiteboard.title);
          setStrokes(data.whiteboard.strokes);
          setImages(data.whiteboard.images);

          // Connect socket
          newSocket = io(SOCKET_URL, { 
            transports: ['websocket'],
            auth: { token: data.wbToken }
          });
          setSocket(newSocket);

          newSocket.on('connect', () => {
            const userId = localStorage.getItem('bb_user_id') || Math.random().toString(36).substr(2, 9);
            localStorage.setItem('bb_user_id', userId);
            newSocket.emit('join_whiteboard', { whiteboardId: id, userName: displayName.trim(), userId });
          });


          newSocket.on('wb_receive_sync_stroke', stroke => {
            liveStrokesRef.current[stroke.id] = stroke;
            renderAllStrokes();
          });
          newSocket.on('wb_receive_stroke', stroke => {
            setStrokes(prev => [...prev, stroke]);
            delete liveStrokesRef.current[stroke.id];
          });
          newSocket.on('wb_clear', () => {
            setStrokes([]);
            setRedoStack([]);
            setImages([]);
            liveStrokesRef.current = {};
            currentStrokeRef.current = null;
          });
          newSocket.on('wb_image_added', img => setImages(prev => [...prev.filter(i => i.id !== img.id), img]));
          newSocket.on('wb_image_updated', img => setImages(prev => prev.map(i => i.id === img.id ? { ...i, ...img } : i)));
          newSocket.on('wb_image_removed', ({ imageId }) => setImages(prev => prev.filter(i => i.id !== imageId)));
          newSocket.on('wb_undo', () => {
            setStrokes(prev => prev.slice(0, -1));
          });
          newSocket.on('user_typing_update', ({ userId, textBoxId, isTyping, userName, color }) => {
            setTypingUsers(prev => {
              if (!isTyping) {
                const next = { ...prev };
                delete next[textBoxId];
                return next;
              }
              return { ...prev, [textBoxId]: { userId, userName, color } };
            });
          });
          newSocket.on('receive_text_content', ({ objectId, content }) => {
            if (activeTextId !== objectId) {
              setImages(prev => prev.map(img => img.id === objectId ? { ...img, content } : img));
            }
          });
          newSocket.on('cursor_move', ({ userId, x, y, userName, color }) => {
            setRemoteCursors(prev => ({ ...prev, [userId]: { x, y, userName, color } }));
          });

          setLoading(false);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load whiteboard.');
        setLoading(false);
      }
    }

    init();

    // Flush any buffered strokes immediately when the tab/window closes
    const handleBeforeUnload = () => {
      const sock = socketRef.current;
      const pending = unpersistedStrokesRef.current;
      if (sock && sock.connected && pending.length > 0) {
        sock.emit('wb_flush_strokes', { whiteboardId: id, strokes: pending });
        unpersistedStrokesRef.current = [];
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (newSocket) newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, joined, displayName]);

  // Setup Canvas
  useEffect(() => {
    if (loading || error) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    renderAllStrokes();
  }, [strokes, ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drawing Handlers
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // ── Ghost shape preview on canvas ───────────────────────────
  const drawGhostShape = (draft) => {
    if (!ctx || !draft) return;
    renderAllStrokes(); // clear stale ghost first
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
      default: // rect
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.stroke();
    }
    ctx.restore();
  };

  const startDrawing = (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
    // Don't start drawing if we clicked on a DOM overlay object
    if (e.target.closest && e.target.closest('[data-wb-object]')) return;
    e.preventDefault();
    if (!ctx) return;
    const { x, y } = getCoordinates(e);

    if (toolType === 'text') {
      if (textInput) submitText(); // submit previous
      setTextInput({ x, y, value: '' });
      return;
    }

    // Sticky: place on click, no drag needed
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
      if (socket && socket.connected) socket.emit('wb_image_added', { whiteboardId: id, image: stickyObj });
      return;
    }

    // Shape: begin drag-to-size
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
      points: [{ x, y }]
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
    if (socket && socket.connected) socket.emit('wb_image_added', { whiteboardId: id, image: textObj });
    setTextInput(null);
  };

  const draw = (e) => {
    e.preventDefault();
    const coords = getCoordinates(e);

    // Throttle cursor emit
    const now = Date.now();
    if (!lastCursorEmitRef.current || now - lastCursorEmitRef.current > 50) {
      if (socket && socket.connected) {
        socket.emit('cursor_move', { whiteboardId: id, x: coords.x, y: coords.y, userName: displayName, color: myColor });
      }
      lastCursorEmitRef.current = now;
    }

    // Update shape ghost during drag
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

    if (socket && socket.connected) {
      socket.emit('wb_draw_sync', { whiteboardId: id, stroke: currentStrokeRef.current });
    }
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
        if (socket && socket.connected) socket.emit('wb_image_added', { whiteboardId: id, image: shapeObj });
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
        socket.emit('wb_draw_stroke', { whiteboardId: id, stroke: finalStroke }, () => {
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

  // Tools
  const clearCanvas = () => {
    if (!window.confirm('Clear the entire whiteboard for everyone?')) return;
    if (!ctx) return;
    const canvas = canvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setStrokes([]);
    setRedoStack([]);
    setImages([]);
    if (socket && socket.connected) socket.emit('wb_clear', { whiteboardId: id });
  };

  const undoStroke = () => {
    if (strokes.length === 0) return;
    const lastStroke = strokes[strokes.length - 1];
    setStrokes(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastStroke]);
    if (socket && socket.connected) socket.emit('wb_undo', { whiteboardId: id });
  };

  const redoStroke = () => {
    if (redoStack.length === 0) return;
    const stroke = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setStrokes(prev => [...prev, stroke]);
    if (socket && socket.connected) socket.emit('wb_draw_stroke', { whiteboardId: id, stroke });
  };

  const updateImage = (imageId, newProps, sync = true) => {
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, ...newProps } : img));
    if (sync && socket && socket.connected) {
      const updated = { id: imageId, ...newProps };
      socket.emit('wb_image_updated', { whiteboardId: id, image: updated });
    }
  };

  const removeImage = (imageId) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    if (socket && socket.connected) {
      socket.emit('wb_image_removed', { whiteboardId: id, imageId });
    }
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
      if (socket && socket.connected) socket.emit('wb_image_added', { whiteboardId: id, image: imgData });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const downloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create temp canvas to merge background and strokes
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d');

    // Fill background
    tCtx.fillStyle = darkMode ? '#13132b' : '#fff8f0';
    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw strokes (already includes images rendered on canvas)
    tCtx.drawImage(canvas, 0, 0);

    // Download the image
    const link = document.createElement('a');
    link.download = `${title || 'Whiteboard'}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  };

  if (!joined) {
    return (
      <div className="bb-bg min-h-screen flex items-center justify-center p-6">
        <div className="bb-card p-6 rounded-xl w-full max-w-sm">
          <h2 className="text-xl font-bold bb-text mb-2">Join Whiteboard</h2>
          <p className="bb-muted text-sm mb-4">Enter your name to collaborate.</p>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className="bb-input w-full mb-4"
            maxLength={30}
          />
          <button
            className="btn-gold w-full"
            onClick={() => {
              if (!displayName.trim()) return;
              sessionStorage.setItem(`wb-name:${id}`, displayName.trim());
              setJoined(true);
            }}
          >
            Enter Whiteboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bb-bg min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bb-bg min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold bb-text mb-2">Error</h2>
          <p className="bb-muted mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="btn-gold px-6 py-2">Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bb-bg min-h-screen flex flex-col overflow-hidden fixed inset-0">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bb-card border-b border-[#C9A84C]/10 z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-xl font-extrabold text-[#C9A84C] tracking-tight hidden sm:block">
            ⬛ BlackBoard
          </button>
          <div className="h-6 w-px bg-white/10 hidden sm:block"></div>
          <div>
            <h1 className="font-bold bb-text text-sm sm:text-base leading-none mb-1">{title}</h1>
            <div className="flex items-center gap-2 text-xs mt-1">
              <AvatarBar users={activeUsers} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setIsShareModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C]/30 text-xs font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all">
            <Share2 size={14} /> Share
          </button>
          <button onClick={toggleTheme} className="p-2 rounded-full border border-white/5 hover:bg-white/5 transition-all text-xl leading-none">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div data-wb-toolbar="true" className="fixed bottom-0 left-0 right-0 md:relative md:flex items-center justify-between px-2 md:px-4 py-2 border-t md:border-t-0 md:border-b z-50 overflow-x-auto no-scrollbar whiteboard-toolbar shadow-[0_-10px_30px_rgba(0,0,0,0.2)] md:shadow-none" style={{ backgroundColor: 'var(--wb-toolbar-bg)', borderColor: 'var(--wb-toolbar-border)' }}>
        <div className="flex items-center gap-2 md:gap-4 shrink-0 mx-auto min-w-max">
          <div className="flex items-center gap-2 border-r border-[#C9A84C]/20 pr-4">
            <button onClick={() => { setToolType('pen'); setActiveTextId(null); }} className={`p-1.5 rounded-lg transition-colors ${toolType === 'pen' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`} title="Pen"><Pen size={18} /></button>
            <button onClick={() => { setToolType('eraser'); setActiveTextId(null); }} className={`p-1.5 rounded-lg transition-colors ${toolType === 'eraser' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`} title="Eraser"><Eraser size={18} /></button>
            <button onClick={() => setToolType('text')} className={`p-1.5 rounded-lg transition-colors ${toolType === 'text' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`} title="Text"><Type size={18} /></button>
            {/* Shape tool with sub-picker */}
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
            </div>
            {/* Sticky note tool */}
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

          <div className="flex items-center gap-1.5 border-r border-[#C9A84C]/20 pr-2 md:pr-4 hidden md:flex">
            {palette.map(c => (
              <button key={c} onClick={() => { setColor(c); if (toolType === 'eraser') setToolType('pen'); }} className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c && toolType !== 'eraser' ? 'scale-125 border-gray-400' : 'border-transparent'}`} style={{ backgroundColor: c }} title={c} />
            ))}
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (toolType === 'eraser') setToolType('pen'); }} className="w-6 h-6 p-0 border-0 rounded cursor-pointer ml-1" />
          </div>

          <div className="flex items-center gap-1 md:gap-2 border-r border-[#C9A84C]/20 pr-2 md:pr-4">
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
            <div className="w-px h-6 bg-[#C9A84C]/20 mx-1 hidden sm:block"></div>
            <button 
              onClick={() => setGridType(g => g === 'none' ? 'dots' : g === 'dots' ? 'lines' : 'none')}
              className={`p-1.5 rounded-lg transition-colors hidden sm:block ${gridType !== 'none' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-gray-700/30'}`}
              title="Toggle Grid"
            >
              <Grid size={16} />
            </button>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={downloadPNG} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-sm font-medium text-gray-300 hover:bg-white/10 transition-all" title="Download PNG">
              <Download size={16} /> Export
            </button>
            <button onClick={toggleFullscreen} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 transition-colors" title="Fullscreen">
              <Maximize size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Canvas Area ───────────────────────────────────────── */}
      <div ref={containerRef} className={`flex-1 relative overflow-hidden bg-[var(--bg)] ${gridType === 'dots' ? 'bg-dot-grid' : gridType === 'lines' ? 'bg-line-grid' : ''}`} onContextMenu={(e) => e.preventDefault()}>

        {/* Render images, text, shapes, and stickies as DOM overlays */}
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
              boardId={id}
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
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {textInput && (
          <textarea
            autoFocus
            value={textInput.value}
            onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
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
              padding: '4px',
              resize: 'none',
              lineHeight: '1.2',
              whiteSpace: 'pre-wrap',
              overflow: 'hidden',
            }}
          />
        )}
      </div>

      <ShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        link={window.location.href}
        title={title || 'Whiteboard'}
      />

      {/* ── Shape picker portal (fixed to escape toolbar overflow:hidden) */}
      {showShapePicker && (
        <div
          className="bg-[var(--card)] border border-[var(--input-border)] rounded-xl shadow-2xl p-2 flex gap-2 z-[200] animate-slide-up"
          style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left }}
        >
          {[
            ['rect', 'Rect', <Square size={16} key="r" />],
            ['circle', 'Circle', <Circle size={16} key="c" />],
            ['triangle', 'Triangle', <Triangle size={16} key="t" />],
            ['diamond', 'Diamond', <Square size={16} key="d" style={{ transform: 'rotate(45deg)' }} />],
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
  );
}
