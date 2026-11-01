import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Circle, Text as KonvaText, Image as KonvaImage } from 'react-konva';
import type { CanvasStroke } from '../types/canvas';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  X,
  Sparkles,
  Lock,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { CanvasStrokeImage } from './CanvasStrokeImage';

interface StudentCanvasViewerProps {
  sessionTitle: string;
  allowDownload: boolean;
  pages: Array<{
    id: string;
    pageNumber: number;
    backgroundAssetUrl?: string | null;
    strokesJson: CanvasStroke[];
  }>;
  onClose: () => void;
}

export const StudentCanvasViewer: React.FC<StudentCanvasViewerProps> = ({
  sessionTitle,
  allowDownload,
  pages,
  onClose,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  const stageRef = useRef<any>(null);
  const activePage = pages[currentPageIndex] || { pageNumber: 1, strokesJson: [] };

  useEffect(() => {
    if (activePage.backgroundAssetUrl) {
      const img = new window.Image();
      img.crossOrigin = 'Anonymous';
      img.src = activePage.backgroundAssetUrl;
      img.onload = () => setBgImage(img);
    } else {
      setBgImage(null);
    }
  }, [currentPageIndex, activePage.backgroundAssetUrl]);

  // Strict Rule 5: Download as PDF only if faculty allowed it
  const handleExportPdf = () => {
    if (!allowDownload) {
      alert('The instructor has restricted PDF downloading for this whiteboard lesson.');
      return;
    }
    if (!stageRef.current) return;

    const doc = new jsPDF('landscape', 'px', [1000, 600]);
    const dataUri = stageRef.current.toDataURL({ pixelRatio: 2 });
    doc.addImage(dataUri, 'PNG', 0, 0, 1000, 600);
    doc.save(`${sessionTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Lesson.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none">
      {/* Top Header */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3 truncate">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
          <span className="font-semibold text-sm truncate">{sessionTitle}</span>
          <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full font-mono">
            Read-Only Canvas
          </span>
        </div>

        {/* Page navigation and zoom */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1 rounded-lg text-xs">
            <button
              disabled={currentPageIndex <= 0}
              onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
              className="p-1 hover:text-indigo-400 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono px-1">
              Page {currentPageIndex + 1} / {pages.length}
            </span>
            <button
              disabled={currentPageIndex >= pages.length - 1}
              onClick={() => setCurrentPageIndex((p) => Math.min(pages.length - 1, p + 1))}
              className="p-1 hover:text-indigo-400 disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center space-x-1 bg-slate-800 px-2 py-1 rounded-lg text-xs">
            <button
              onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
              className="p-1 hover:text-indigo-400 cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px] px-1">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(2.0, s + 0.2))}
              className="p-1 hover:text-indigo-400 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* PDF Download strictly governed by allowDownload */}
          {allowDownload ? (
            <button
              onClick={handleExportPdf}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer shadow-sm shadow-indigo-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          ) : (
            <div
              title="Instructor has disabled downloads for this board"
              className="flex items-center space-x-1.5 bg-slate-800 text-slate-500 text-xs px-3 py-1.5 rounded-lg font-mono border border-slate-700/50 cursor-not-allowed"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Download Restricted</span>
            </div>
          )}

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Canvas Display Viewport */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-slate-950">
        <div
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
          className="border border-slate-800 rounded-xl overflow-hidden shadow-2xl bg-slate-900 transition-transform duration-150"
        >
          <Stage ref={stageRef} width={1000} height={600} listening={false}>
            <Layer>
              {bgImage && (
                <KonvaImage image={bgImage} width={1000} height={600} listening={false} />
              )}

              {(activePage.strokesJson || []).map((s) => {
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
                if (s.tool === 'image') {
                  return <CanvasStrokeImage key={s.id} stroke={s} />;
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
                    />
                  );
                }
                return null;
              })}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
};
