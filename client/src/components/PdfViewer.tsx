import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  AlertCircle,
  X,
  FileText,
  Lock,
} from 'lucide-react';
import api, { getAccessToken, resolveFileUrl } from '../api/client';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  materialId: string;
  title: string;
  onClose: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ materialId, title, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allowDownload, setAllowDownload] = useState<boolean>(false);
  const [isConverted, setIsConverted] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    const loadDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch signed temporary view URL from server
        const res = await api.get(`/materials/${materialId}/view-url`);
        const { viewUrl, allowDownload: canDownload, isConverted: converted } = res.data;

        if (isCancelled) return;

        setAllowDownload(Boolean(canDownload));
        setIsConverted(Boolean(converted));

        // Load PDF via PDF.js with bearer token and credentials
        const token = getAccessToken();
        const resolvedUrl = resolveFileUrl(viewUrl, token);
        const loadingTask = pdfjsLib.getDocument({
          url: resolvedUrl,
          withCredentials: true,
          httpHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('PDF.js render error:');
          setError(
            err.response?.data?.message ||
              'Unable to render document preview. If this is an Office document, ensure server conversion is enabled.'
          );
          setLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [materialId]);

  // Render page onto canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:');
        }
      }
    };

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale]);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const res = await api.get(`/materials/${materialId}/download-url`);
      const { downloadUrl, filename } = res.data;

      // Trigger secure download via blob to ensure headers and auth work everywhere
      const fileRes = await api.get(downloadUrl, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(fileRes.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || `${title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Download forbidden or expired.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md">
      {/* Top toolbar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white select-none">
        <div className="flex items-center space-x-3 truncate">
          <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
          <span className="font-semibold text-sm truncate">{title}</span>
          {isConverted && (
            <span className="text-[10px] bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full font-mono">
              Converted PDF Preview
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-3">
          {numPages > 0 && (
            <div className="flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1 rounded-lg text-xs">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono">
                {currentPage} / {numPages}
              </span>
              <button
                disabled={currentPage >= numPages}
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                className="p-1 hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Zoom buttons */}
          <div className="flex items-center space-x-1 bg-slate-800/80 px-2 py-1 rounded-lg text-xs">
            <button
              onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
              className="p-1 hover:text-indigo-400 cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px] px-1">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
              className="p-1 hover:text-indigo-400 cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Download button strictly guarded by allowDownload */}
          {allowDownload ? (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer shadow-sm shadow-indigo-500/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
            </button>
          ) : (
            <div
              title="Instructor has disabled downloads for this material"
              className="flex items-center space-x-1.5 bg-slate-800 text-slate-500 text-xs px-3 py-1.5 rounded-lg font-mono border border-slate-700/50 cursor-not-allowed"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Download Disabled</span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Viewer content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-slate-950">
        {loading && (
          <div className="flex flex-col items-center space-y-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Loading secure document stream...</p>
          </div>
        )}

        {error && (
          <div className="max-w-md p-6 bg-slate-900 border border-red-900/50 rounded-2xl text-center text-slate-300 space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <h3 className="font-semibold text-white">Preview Unavailable</h3>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-white">
            <canvas ref={canvasRef} />
          </div>
        )}
      </div>
    </div>
  );
};
