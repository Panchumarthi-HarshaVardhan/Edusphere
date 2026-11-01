import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Circle, Text as KonvaText, Image as KonvaImage } from 'react-konva';
import type { CanvasStroke } from '../types/canvas';
import {
  Pen,
  Eraser,
  Square,
  Circle as CircleIcon,
  Type,
  Image as ImageIcon,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Upload,
  CheckCircle,
  Cloud,
  X,
} from 'lucide-react';
import api from '../api/client';
import * as pdfjsLib from 'pdfjs-dist';
import { CanvasStrokeImage } from './CanvasStrokeImage';

const createStrokeId = () => globalThis.crypto.randomUUID();

interface CanvasWorkspaceProps {
  sessionId: string;
  initialPages: Array<{
    id: string;
    pageNumber: number;
    backgroundAssetUrl?: string | null;
    strokesJson: CanvasStroke[];
  }>;
  sessionTitle: string;
  allowDownload: boolean;
  onClose: () => void;
}

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  sessionId,
  initialPages,
  sessionTitle,
  onClose,
}) => {
  const [pages, setPages] = useState(initialPages);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Drawing Tools
  const [tool, setTool] = useState<'pen' | 'eraser' | 'rectangle' | 'circle' | 'text'>('pen');
  const [color, setColor] = useState('#6366f1'); // Indigo default
  const [size, setSize] = useState(3);

  // Undo / Redo history
  const [history, setHistory] = useState<CanvasStroke[][]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);

  // Autosave status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [finishError, setFinishError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const pendingChanges = useRef(false);
  const activeSave = useRef<Promise<unknown> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageViewportRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(1);

  // Stage reference
  const isDrawing = useRef(false);

  // Current active page
  const activePage = pages[currentPageIndex] || { pageNumber: 1, strokesJson: [] };
  const [currentStrokes, setCurrentStrokes] = useState<CanvasStroke[]>(activePage.strokesJson || []);
  const latestStrokes = useRef(currentStrokes);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    latestStrokes.current = currentStrokes;
  }, [currentStrokes]);

  useEffect(() => {
    const viewport = stageViewportRef.current;
    if (!viewport) return;
    const resizeStage = () => {
      const widthScale = (viewport.clientWidth - 32) / 1000;
      const heightScale = (viewport.clientHeight - 32) / 600;
      setStageScale(Math.max(0.2, Math.min(1.35, widthScale, heightScale)));
    };
    const observer = new ResizeObserver(resizeStage);
    observer.observe(viewport);
    resizeStage();
    return () => observer.disconnect();
  }, []);

  const commitText = () => {
    if (!textDraft) return;
    const value = textDraft.value.trim();
    if (value) {
      const textStroke: CanvasStroke = {
        id: createStrokeId(),
        tool: 'text',
        color,
        size: 20,
        x: textDraft.x,
        y: textDraft.y,
        text: value,
      };
      const updated = [...currentStrokes, textStroke];
      setCurrentStrokes(updated);
      pushHistory(updated);
      markDirty();
    }
    setTextDraft(null);
  };

  // Load Background Image
  useEffect(() => {
    if (activePage.backgroundAssetUrl) {
      const img = new window.Image();
      img.crossOrigin = 'Anonymous';
      img.src = activePage.backgroundAssetUrl;
      img.onload = () => setBgImage(img);
    } else {
      setBgImage(null);
    }
    setCurrentStrokes(activePage.strokesJson || []);
    setHistory([activePage.strokesJson || []]);
    setHistoryStep(0);
  }, [currentPageIndex, activePage.backgroundAssetUrl]);

  const markDirty = () => {
    pendingChanges.current = true;
    setSaveStatus('dirty');
  };

  // Debounced Autosave to Backend. The pending flag avoids canceling a save
  // when the status changes from dirty to saving.
  useEffect(() => {
    if (!pendingChanges.current) return;
    const strokesToSave = currentStrokes;
    const pageNumberToSave = activePage.pageNumber;
    const backgroundToSave = activePage.backgroundAssetUrl;
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      setSaveStatus('saving');
      try {
        const request = api.put(`/canvas/sessions/${sessionId}/pages/${pageNumberToSave}`, {
          strokesJson: strokesToSave,
          backgroundAssetUrl: backgroundToSave,
        });
        activeSave.current = request;
        await request;
        activeSave.current = null;
        const hasNewerChanges = latestStrokes.current !== strokesToSave;
        pendingChanges.current = hasNewerChanges;
        setSaveStatus(hasNewerChanges ? 'dirty' : 'saved');
        // Update local pages state
        setPages((prev) =>
          prev.map((p, idx) =>
            idx === currentPageIndex ? { ...p, strokesJson: strokesToSave } : p
          )
        );
      } catch {
        activeSave.current = null;
        pendingChanges.current = true;
        setSaveStatus('dirty');
      }
    }, 1500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
    };
  }, [currentStrokes, sessionId, activePage.pageNumber, activePage.backgroundAssetUrl, currentPageIndex]);

  const saveCurrentPage = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    await api.put(`/canvas/sessions/${sessionId}/pages/${activePage.pageNumber}`, {
      strokesJson: currentStrokes,
      backgroundAssetUrl: activePage.backgroundAssetUrl,
    });
    pendingChanges.current = false;
    setSaveStatus('saved');
  };

  const finishClass = async () => {
    setIsFinishing(true);
    setFinishError(null);
    try {
      if (activeSave.current) await activeSave.current;
      if (pendingChanges.current) await saveCurrentPage();
      await api.post(`/canvas/sessions/${sessionId}/complete`);
      onClose();
    } catch (error: any) {
      setFinishError(error.response?.data?.message || 'Could not save and share this canvas. Please try again.');
    } finally {
      setIsFinishing(false);
    }
  };

  const saveAndClose = async () => {
    setFinishError(null);
    try {
      if (activeSave.current) await activeSave.current;
      if (pendingChanges.current) await saveCurrentPage();
      onClose();
    } catch (error: any) {
      setFinishError(error.response?.data?.message || 'Could not save the canvas. Please try again.');
    }
  };

  // Pointer Down (Mouse / Stylus / Touch)
  const handlePointerDown = (e: any) => {
    isDrawing.current = true;
    const pointer = e.target.getStage().getPointerPosition();
    if (!pointer) return;
    const pos = { x: pointer.x / stageScale, y: pointer.y / stageScale };

    // Stylus pressure support
    const pressure = e.evt?.pressure || 0.5;
    const dynamicSize = tool === 'pen' ? Math.max(1, size * (pressure > 0 ? pressure * 1.5 : 1)) : size * 2;

    if (tool === 'pen' || tool === 'eraser') {
      const newStroke: CanvasStroke = {
        id: `${Date.now()}-${Math.random()}`,
        tool,
        color: tool === 'eraser' ? '#0f172a' : color,
        size: dynamicSize,
        points: [pos.x, pos.y],
      };
      setCurrentStrokes((prev) => [...prev, newStroke]);
    } else if (tool === 'rectangle' || tool === 'circle') {
      const newShape: CanvasStroke = {
        id: `${Date.now()}-${Math.random()}`,
        tool,
        color,
        size,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
      };
      setCurrentStrokes((prev) => [...prev, newShape]);
    } else if (tool === 'text') {
      setTextDraft({ x: pos.x, y: pos.y, value: '' });
      isDrawing.current = false;
    }
  };

  // Pointer Move
  const handlePointerMove = (e: any) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const point = { x: pointer.x / stageScale, y: pointer.y / stageScale };

    setCurrentStrokes((prev) => {
      if (prev.length === 0) return prev;
      const lastStroke = { ...prev[prev.length - 1] };

      if (lastStroke.tool === 'pen' || lastStroke.tool === 'eraser') {
        lastStroke.points = [...(lastStroke.points || []), point.x, point.y];
      } else if (lastStroke.tool === 'rectangle' || lastStroke.tool === 'circle') {
        lastStroke.width = point.x - (lastStroke.x || 0);
        lastStroke.height = point.y - (lastStroke.y || 0);
      }

      return [...prev.slice(0, -1), lastStroke];
    });
  };

  // Pointer Up
  const handlePointerUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    pushHistory(currentStrokes);
    markDirty();
  };

  const pushHistory = (newStrokes: CanvasStroke[]) => {
    const newHistory = history.slice(0, historyStep + 1);
    setHistory([...newHistory, newStrokes]);
    setHistoryStep(newHistory.length);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      const nextStep = historyStep - 1;
      setHistoryStep(nextStep);
      setCurrentStrokes(history[nextStep]);
      markDirty();
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      setCurrentStrokes(history[nextStep]);
      markDirty();
    }
  };

  // Page Management
  const handleAddPage = async () => {
    try {
      const res = await api.post(`/canvas/sessions/${sessionId}/pages`);
      setPages((prev) => [...prev, res.data.page]);
      setCurrentPageIndex(pages.length);
    } catch {
      console.error('Failed to add page:');
    }
  };

  const handleDeletePage = async () => {
    if (pages.length <= 1) {
      alert('A session must have at least one board page.');
      return;
    }
    if (!window.confirm(`Delete Page ${activePage.pageNumber}?`)) return;

    try {
      await api.delete(`/canvas/sessions/${sessionId}/pages/${activePage.pageNumber}`);
      setPages((prev) => prev.filter((_, idx) => idx !== currentPageIndex));
      setCurrentPageIndex((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete page');
    }
  };

  // Image Upload on Canvas
  const handleInsertImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/canvas/sessions/${sessionId}/assets/upload`, formData, {
      });
      const imgStroke: CanvasStroke = {
        id: `${Date.now()}`,
        tool: 'image',
        x: 100,
        y: 100,
        width: 300,
        height: 200,
        imageAssetId: res.data.id,
      };
      const updated = [...currentStrokes, imgStroke];
      setCurrentStrokes(updated);
      pushHistory(updated);
      markDirty();
    } catch (err: any) {
      setFinishError(err.response?.data?.message || 'Image upload failed. Check the image type and try again.');
    } finally {
      e.target.value = '';
    }
  };

  // Import Document Slides (PDF/PPT)
  const handleImportSlides = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setSaveStatus('saving');
      const res = await api.post(`/canvas/sessions/${sessionId}/import-slides`, formData, {
      });

      // Render PDF pages to slide background images
      const loadingTask = pdfjsLib.getDocument({ url: res.data.pdfUrl, withCredentials: true });
      const pdf = await loadingTask.promise;

      const newPagesToAdd: string[] = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/png');
          newPagesToAdd.push(dataUrl);
        }
      }

      // Populate pages
      for (let i = 0; i < newPagesToAdd.length; i++) {
        if (i === 0) {
          await api.put(`/canvas/sessions/${sessionId}/pages/${activePage.pageNumber}`, {
            strokesJson: currentStrokes,
            backgroundAssetUrl: newPagesToAdd[0],
          });
          setPages((prev) =>
            prev.map((p, idx) =>
              idx === currentPageIndex ? { ...p, backgroundAssetUrl: newPagesToAdd[0] } : p
            )
          );
        } else {
          const added = await api.post(`/canvas/sessions/${sessionId}/pages`);
          await api.put(`/canvas/sessions/${sessionId}/pages/${added.data.page.pageNumber}`, {
            strokesJson: [],
            backgroundAssetUrl: newPagesToAdd[i],
          });
          setPages((prev) => [
            ...prev,
            { ...added.data.page, backgroundAssetUrl: newPagesToAdd[i] },
          ]);
        }
      }

      setSaveStatus('saved');
    } catch {
      console.error('Slide import error:');
      alert('Could not convert slides into board pages.');
      setSaveStatus('saved');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col overflow-hidden bg-slate-950 text-white select-none">
      {/* Top Header */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="font-semibold text-sm truncate">{sessionTitle}</span>
          <span className="text-xs text-slate-400 font-mono">
            Page {currentPageIndex + 1} of {pages.length}
          </span>
        </div>

        {/* Autosave Indicator */}
        <div className="flex items-center space-x-2 text-xs">
          {saveStatus === 'saved' && (
            <span className="flex items-center space-x-1.5 text-emerald-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Saved</span>
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="flex items-center space-x-1.5 text-indigo-400 animate-pulse font-medium">
              <Cloud className="w-3.5 h-3.5" />
              <span>Autosaving board...</span>
            </span>
          )}
          {saveStatus === 'dirty' && (
            <span className="flex items-center space-x-1.5 text-amber-400 font-medium">
              <Cloud className="w-3.5 h-3.5" />
              <span>Unsaved strokes</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button onClick={saveAndClose} disabled={isFinishing || saveStatus === 'saving'} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-50" title="Save and close canvas">
            <X className="h-3.5 w-3.5" /><span className="hidden sm:inline">Save & close</span>
          </button>
          <button
            onClick={finishClass}
            disabled={isFinishing || saveStatus === 'saving'}
            className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            <span>{isFinishing ? 'Saving and sharing…' : 'Finish class & share'}</span>
          </button>
        </div>
      </div>
      {finishError && (
        <div role="alert" className="border-b border-red-800 bg-red-950 px-4 py-2 text-center text-xs text-red-200">
          {finishError}
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Floating Toolbar */}
        <div className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 space-y-3 z-10 shrink-0">
          <button
            onClick={() => setTool('pen')}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              tool === 'pen' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Pen Tool (Pressure sensitive)"
          >
            <Pen className="w-5 h-5" />
          </button>

          <button
            onClick={() => setTool('eraser')}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              tool === 'eraser' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Eraser Tool"
          >
            <Eraser className="w-5 h-5" />
          </button>

          <div className="w-8 h-px bg-slate-800 my-1" />

          <button
            onClick={() => setTool('rectangle')}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              tool === 'rectangle' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Rectangle"
          >
            <Square className="w-5 h-5" />
          </button>

          <button
            onClick={() => setTool('circle')}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              tool === 'circle' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Circle"
          >
            <CircleIcon className="w-5 h-5" />
          </button>

          <button
            onClick={() => setTool('text')}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              tool === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Text annotation"
          >
            <Type className="w-5 h-5" />
          </button>

          {/* Insert Image */}
          <label
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Insert Image"
          >
            <ImageIcon className="w-5 h-5" />
            <input type="file" accept="image/*" onChange={handleInsertImage} className="hidden" />
          </label>

          {/* Import Slides */}
          <label
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Import PDF/PPT Slides as Board Backgrounds"
          >
            <Upload className="w-5 h-5 text-indigo-400" />
            <input type="file" accept=".pdf,.ppt,.pptx" onChange={handleImportSlides} className="hidden" />
          </label>

          <div className="w-8 h-px bg-slate-800 my-1" />

          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            disabled={historyStep <= 0}
            className="p-2.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
            title="Undo"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
            className="p-2.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
            title="Redo"
          >
            <Redo2 className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas Workspace Center */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-950">
          {/* Tool Settings Bar (Colors & Sizes) */}
          <div className="h-10 bg-slate-900/60 border-b border-slate-800/80 px-4 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 font-medium">Color:</span>
              {['#ffffff', '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#06b6d4'].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full border-2 transition cursor-pointer ${
                    color === c ? 'border-white scale-110 shadow-md' : 'border-transparent'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-400 font-medium">Thickness:</span>
              {[2, 4, 8, 14].map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                    size === s ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Konva Stage */}
          <div ref={stageViewportRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
            <div className="relative border border-slate-800 rounded-xl overflow-hidden shadow-2xl bg-slate-900">
              <Stage
                width={1000 * stageScale}
                height={600 * stageScale}
                scaleX={stageScale}
                scaleY={stageScale}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <Layer>
                  {/* Background Canvas Layer (imported slide or pure whiteboard) */}
                  {bgImage && (
                    <KonvaImage
                      image={bgImage}
                      width={1000}
                      height={600}
                      listening={false}
                    />
                  )}

                  {/* Render Strokes */}
                  {currentStrokes.map((s) => {
                    if (s.tool === 'pen' || s.tool === 'eraser') {
                      return (
                        <Line
                          key={s.id}
                          points={s.points}
                          stroke={s.color}
                          strokeWidth={s.size}
                          tension={0.5}
                          lineCap="round"
                          lineJoin="round"
                          globalCompositeOperation={
                            s.tool === 'eraser' ? 'destination-out' : 'source-over'
                          }
                        />
                      );
                    }
                    if (s.tool === 'rectangle') {
                      return (
                        <Rect
                          key={s.id}
                          x={s.x}
                          y={s.y}
                          width={s.width}
                          height={s.height}
                          stroke={s.color}
                          strokeWidth={s.size}
                        />
                      );
                    }
                    if (s.tool === 'circle') {
                      const radius = Math.sqrt(
                        Math.pow(s.width || 0, 2) + Math.pow(s.height || 0, 2)
                      );
                      return (
                        <Circle
                          key={s.id}
                          x={s.x}
                          y={s.y}
                          radius={radius}
                          stroke={s.color}
                          strokeWidth={s.size}
                        />
                      );
                    }
                    if (s.tool === 'text') {
                      return (
                        <KonvaText
                          key={s.id}
                          x={s.x}
                          y={s.y}
                          text={s.text}
                          fontSize={s.size || 16}
                          fill={s.color}
                          draggable
                        />
                      );
                    }
                    if (s.tool === 'image') {
                      return <CanvasStrokeImage key={s.id} stroke={s} draggable />;
                    }
                    return null;
                  })}
                </Layer>
              </Stage>
              {textDraft && (
                <input
                  autoFocus
                  aria-label="Canvas text"
                  value={textDraft.value}
                  onChange={(event) => setTextDraft({ ...textDraft, value: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitText();
                    if (event.key === 'Escape') setTextDraft(null);
                  }}
                  style={{ left: textDraft.x * stageScale, top: textDraft.y * stageScale, color, fontSize: `${Math.max(10, 14 * stageScale)}px` }}
                  className="absolute z-10 min-w-32 border-b border-indigo-400 bg-slate-950/90 px-1 text-sm outline-none"
                  placeholder="Type and press Enter"
                />
              )}
            </div>
          </div>

          {/* Bottom Multi-Page Board Navigation */}
          <div className="h-14 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                disabled={currentPageIndex <= 0}
                onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 rounded-lg cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono text-slate-300 px-2">
                Page {currentPageIndex + 1} / {pages.length}
              </span>

              <button
                disabled={currentPageIndex >= pages.length - 1}
                onClick={() => setCurrentPageIndex((p) => Math.min(pages.length - 1, p + 1))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 rounded-lg cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddPage}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Board Page</span>
              </button>

              {pages.length > 1 && (
                <button
                  onClick={handleDeletePage}
                  className="p-1.5 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg transition cursor-pointer"
                  title="Delete current page"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
