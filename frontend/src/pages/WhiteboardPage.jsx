// src/pages/WhiteboardPage.jsx
// Full Standalone Whiteboard with shareable link and real-time sync.
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Pen, Eraser, Trash2, Undo, Maximize, Download, Image as ImageIcon, Copy, Check, Type } from 'lucide-react';

const API = process.env.REACT_APP_API_URL;
const SOCKET_URL = process.env.REACT_APP_API_URL;

export default function WhiteboardPage({ darkMode, toggleTheme }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [ctx, setCtx] = useState(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [userCount, setUserCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Whiteboard State
  const [title, setTitle] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#C9A84C');
  const [lineWidth, setLineWidth] = useState(3);
  const [toolType, setToolType] = useState('pen'); // 'pen', 'eraser', 'text'
  const [textInput, setTextInput] = useState(null);
  const [images, setImages] = useState([]);
  const [strokes, setStrokes] = useState([]);

  const [copied, setCopied] = useState(false);

  const lastPos = useRef({ x: 0, y: 0 });
  const palette = ['#C9A84C', '#ED93B1', '#AFA9EC', '#f5ecd7', '#000000'];

  // Fetch initial data & setup socket
  useEffect(() => {
    let newSocket;

    async function init() {
      try {
        const { data } = await axios.get(`${API}/api/whiteboards/${id}`);
        if (data.success) {
          setTitle(data.whiteboard.title);
          setStrokes(data.whiteboard.strokes);
          setImages(data.whiteboard.images);

          // Connect socket
          newSocket = io(SOCKET_URL, { transports: ['websocket'] });
          setSocket(newSocket);

          newSocket.on('connect', () => {
            setConnected(true);
            newSocket.emit('join_whiteboard', { whiteboardId: id });
          });

          newSocket.on('wb_user_joined', () => setUserCount(c => c + 1));
          newSocket.on('wb_receive_stroke', stroke => {
            setStrokes(prev => [...prev, stroke]);
            drawStrokeOnCanvas(stroke, canvasRef.current.getContext('2d'));
          });
          newSocket.on('wb_clear', () => {
            setStrokes([]);
            setImages([]);
            const canvas = canvasRef.current;
            if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
          });
          newSocket.on('wb_image_added', img => setImages(prev => [...prev, img]));
          newSocket.on('wb_undo', () => {
            setStrokes(prev => prev.slice(0, -1));
          });
          newSocket.on('disconnect', () => setConnected(false));

          setLoading(false);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load whiteboard.');
        setLoading(false);
      }
    }

    init();

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [id]);

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

    // Redraw existing strokes
    context.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(s => drawStrokeOnCanvas(s, context));

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
      ctxNew.clearRect(0, 0, canvas.width, canvas.height);
      setStrokes(prev => {
        prev.forEach(s => drawStrokeOnCanvas(s, ctxNew));
        return prev;
      });
      setCtx(ctxNew);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [loading, error]); // intentionally not adding strokes to deps to avoid resetting ctx

  // When strokes change due to UNDO, redraw all
  useEffect(() => {
    if (!ctx || !canvasRef.current) return;
    const canvas = canvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(s => drawStrokeOnCanvas(s, ctx));
  }, [strokes, ctx]);

  function drawStrokeOnCanvas(stroke, context) {
    if (!context) return;

    if (stroke.type === 'text') {
      context.font = `${stroke.lineWidth * 2 + 10}px Inter`;
      context.fillStyle = stroke.color;
      context.textBaseline = 'top';
      context.fillText(stroke.content, stroke.x, stroke.y);
      return;
    }

    context.beginPath();
    context.moveTo(stroke.startX, stroke.startY);
    context.lineTo(stroke.endX, stroke.endY);
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.lineWidth;
    context.globalCompositeOperation = stroke.isEraser ? 'destination-out' : 'source-over';
    context.stroke();
    context.globalCompositeOperation = 'source-over';
  }

  // Drawing Handlers
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
      if (textInput) submitText(); // submit previous
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
    drawStrokeOnCanvas(stroke, ctx);
    setStrokes(prev => [...prev, stroke]);
    if (socket && socket.connected) {
      socket.emit('wb_draw_stroke', { whiteboardId: id, stroke });
    }
    setTextInput(null);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing || !ctx) return;
    const { x, y } = getCoordinates(e);

    const stroke = {
      startX: lastPos.current.x,
      startY: lastPos.current.y,
      endX: x,
      endY: y,
      color: toolType === 'eraser' ? 'rgba(0,0,0,1)' : color,
      lineWidth,
      isEraser: toolType === 'eraser'
    };

    drawStrokeOnCanvas(stroke, ctx);
    setStrokes(prev => [...prev, stroke]);

    if (socket && socket.connected) {
      socket.emit('wb_draw_stroke', { whiteboardId: id, stroke });
    }

    lastPos.current = { x, y };
  };

  const stopDrawing = () => setIsDrawing(false);

  // Tools
  const clearCanvas = () => {
    if (!window.confirm('Clear the entire whiteboard for everyone?')) return;
    if (!ctx) return;
    const canvas = canvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setStrokes([]);
    setImages([]);
    if (socket && socket.connected) socket.emit('wb_clear', { whiteboardId: id });
  };

  const undoStroke = () => {
    if (strokes.length === 0) return;
    setStrokes(prev => prev.slice(0, -1));
    if (socket && socket.connected) socket.emit('wb_undo', { whiteboardId: id });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      const imgData = {
        src: base64, x: 50, y: 50, width: 200, height: 200, id: Date.now()
      };
      setImages(prev => [...prev, imgData]);
      if (socket && socket.connected) socket.emit('wb_image_added', { whiteboardId: id, image: imgData });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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

    // Create temp canvas to merge background, images, and strokes
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d');

    // Fill background
    tCtx.fillStyle = darkMode ? '#13132b' : '#fff8f0';
    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw images
    const drawImages = () => {
      return Promise.all(images.map(imgData => {
        return new Promise(resolve => {
          const img = new Image();
          img.src = imgData.src;
          img.onload = () => {
            const dpr = window.devicePixelRatio || 1;
            tCtx.drawImage(img, imgData.x * dpr, imgData.y * dpr, imgData.width * dpr, imgData.height * dpr);
            resolve();
          };
        });
      }));
    };

    drawImages().then(() => {
      // Draw strokes
      tCtx.drawImage(canvas, 0, 0);

      const link = document.createElement('a');
      link.download = `${title || 'Whiteboard'}.png`;
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
    });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-[#1D9E75] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#1D9E75] animate-pulse"></span> {userCount} online
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C]/30 text-xs font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Share'}
          </button>
          <button onClick={toggleTheme} className="p-2 rounded-full border border-white/5 hover:bg-white/5 transition-all text-xl leading-none">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-center md:justify-between px-4 py-2 border-b z-20 shrink-0 overflow-x-auto"
        style={{ backgroundColor: 'var(--wb-toolbar-bg)', borderColor: 'var(--wb-toolbar-border)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setToolType('pen')} className={`p-2 rounded-lg transition-colors ${toolType === 'pen' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-white/5'}`} title="Pen">
            <Pen size={18} />
          </button>
          <button onClick={() => setToolType('eraser')} className={`p-2 rounded-lg transition-colors ${toolType === 'eraser' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-white/5'}`} title="Eraser">
            <Eraser size={18} />
          </button>
          <button onClick={() => setToolType('text')} className={`p-2 rounded-lg transition-colors ${toolType === 'text' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-gray-400 hover:bg-white/5'}`} title="Text">
            <Type size={18} />
          </button>

          <div className="w-px h-6 bg-white/10 mx-2"></div>

          {palette.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); if (toolType === 'eraser') setToolType('pen'); }}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c && toolType !== 'eraser' ? 'scale-125 border-gray-400' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (toolType === 'eraser') setToolType('pen'); }} className="w-6 h-6 p-0 border-0 rounded cursor-pointer ml-1" />

          <div className="w-px h-6 bg-white/10 mx-2"></div>

          <input type="range" min="1" max="20" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} className="w-24 accent-[#C9A84C]" title="Stroke width" />
        </div>

        <div className="flex items-center gap-2 ml-4 md:ml-0">
          <button onClick={undoStroke} className="p-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors" title="Undo">
            <Undo size={18} />
          </button>
          <label className="cursor-pointer p-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors flex items-center" title="Upload Image">
            <ImageIcon size={18} />
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
          <button onClick={downloadPNG} className="p-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors" title="Download PNG">
            <Download size={18} />
          </button>
          <button onClick={clearCanvas} className="p-2 rounded-lg text-[#ED93B1] hover:bg-[#ED93B1]/10 transition-colors" title="Clear All">
            <Trash2 size={18} />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <button onClick={toggleFullscreen} className="p-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors" title="Fullscreen">
            <Maximize size={18} />
          </button>
        </div>
      </div>

      {/* ── Canvas Area ───────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[var(--bg)] cursor-crosshair">

        {/* Render images as DOM elements underneath the canvas drawing layer */}
        {images.map((img) => (
          <img
            key={img.id}
            src={img.src}
            alt="Upload"
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
