// components/common/UI/PDFViewer.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  DocumentIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Set up PDF.js worker - using local worker file served from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

interface PDFViewerProps {
  fileUrl: string;
  fileName?: string;
  className?: string;
  maxWidth?: number;
  maxHeight?: number;
  showControls?: boolean;
  showZoom?: boolean;
  theme?: 'light' | 'dark';
}

const PDFViewer: React.FC<PDFViewerProps> = React.memo(({
  fileUrl,
  fileName = 'Document',
  className = '',
  maxWidth = 600,
  maxHeight = 800,
  showControls = true,
  showZoom = false,
  theme = 'light'
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(0.75); // Default to 75% for better fit
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    setError(`PDF Load Error: ${error.message}`);
    setLoading(false);
  }, []);

  const goToPrevPage = useCallback(() => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber(prev => Math.min(prev + 1, numPages));
  }, [numPages]);

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 3.0)); // Allow up to 300% zoom
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.5)); // Allow down to 50% zoom
  }, []);

  const resetZoom = useCallback(() => {
    setScale(0.75); // Reset to 75% for better fit
  }, []);

  // Memoize document options to prevent re-renders
  const documentOptions = useMemo(() => ({
    workerSrc: '/pdfjs/pdf.worker.min.js'
  }), []);

  // Memoize container style - better alignment for inline view
  const containerStyle = useMemo(() => showZoom ? ({ 
    width: '100%',
    maxWidth: scale > 1.0 ? maxWidth * 2 : maxWidth, 
    maxHeight: scale > 1.0 ? maxHeight * 1.5 : maxHeight,
    overflow: 'auto', // Allow scrolling when zoomed
    position: 'relative' as const
  }) : ({
    width: '100%',
    maxWidth,
    maxHeight,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  }), [maxWidth, maxHeight, scale, showZoom]);

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 border-2 border-dashed border-red-300 dark:border-red-600 rounded-lg bg-red-50 dark:bg-red-900/20 ${className}`}>
        <ExclamationTriangleIcon className="h-16 w-16 text-red-500 dark:text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">Failed to Load PDF</h3>
        <p className="text-sm text-red-600 dark:text-red-400 text-center mb-4">
          Unable to display the PDF document. This might be due to:
        </p>
        <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 mb-4">
          <li>• Corrupted or invalid PDF file</li>
          <li>• Network connectivity issues</li>
          <li>• Browser compatibility problems</li>
        </ul>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
        >
          Download PDF Instead
        </a>
      </div>
    );
  }

  return (
    <div className={`pdf-viewer ${className}`}>
      {/* Controls */}
      {showControls && (
        <div className="flex items-center justify-between mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <DocumentIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {fileName}
            </span>
          </div>
          
          {numPages > 0 && (
            <div className="flex items-center space-x-4">
              {/* Page Navigation */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPrevPage}
                  disabled={pageNumber <= 1}
                  className="p-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous Page"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                
                <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                  Page {pageNumber} of {numPages}
                </span>
                
                <button
                  onClick={goToNextPage}
                  disabled={pageNumber >= numPages}
                  className="p-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next Page"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Zoom Controls - Only show in modal */}
              {showZoom && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={zoomOut}
                    disabled={scale <= 0.5}
                    className="p-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Zoom Out"
                  >
                    <ArrowsPointingInIcon className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={resetZoom}
                    className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                    title="Reset Zoom"
                  >
                    {Math.round(scale * 100)}%
                  </button>
                  
                  <button
                    onClick={zoomIn}
                    disabled={scale >= 3.0}
                    className="p-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Zoom In"
                  >
                    <ArrowsPointingOutIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PDF Document */}
      <div className="flex justify-center">
        <div 
          className="border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg bg-white dark:bg-gray-800"
          style={containerStyle}
        >
          {loading && (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading PDF...</p>
            </div>
          )}
          
          <div className={showZoom ? "flex justify-center items-start p-4" : "flex justify-center items-center p-2 min-h-[400px]"}>
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
              error={null}
              className="pdf-document"
              options={documentOptions}
            >
              <Page
                pageNumber={pageNumber}
                scale={showZoom ? scale : 0.8} // Slightly larger scale for better readability with increased height
                loading={null}
                error={null}
                className="pdf-page"
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          </div>
        </div>
      </div>

      {/* Page Indicator for Mobile */}
      {numPages > 1 && (
        <div className="flex justify-center mt-4 md:hidden">
          <div className="flex space-x-1">
            {Array.from({ length: numPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setPageNumber(i + 1)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  pageNumber === i + 1
                    ? 'bg-blue-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
                title={`Go to page ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

PDFViewer.displayName = 'PDFViewer';

export default PDFViewer;