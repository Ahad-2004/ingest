import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Crop } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

interface ImageCropModalProps {
    pdfFile: File;
    onCropComplete: (croppedImage: string) => void;
    onClose: () => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({ pdfFile, onCropComplete, onClose }) => {
    const [pdfPages, setPdfPages] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [isSelecting, setIsSelecting] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [endPos, setEndPos] = useState({ x: 0, y: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load PDF pages
    useEffect(() => {
        const loadPDF = async () => {
            try {
                setIsLoading(true);
                const arrayBuffer = await pdfFile.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const pages: string[] = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 2 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');

                    if (!context) continue;

                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    await page.render({
                        canvasContext: context,
                        viewport: viewport,
                    }).promise;

                    pages.push(canvas.toDataURL('image/jpeg', 0.95));
                }

                setPdfPages(pages);
                setIsLoading(false);
            } catch (error) {
                console.error('Error loading PDF:', error);
                setIsLoading(false);
            }
        };

        loadPDF();
    }, [pdfFile]);

    // Helper to get correct coordinates adjusted for canvas scaling
    const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Calculate scale factors
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    // Handle mouse down - start selection
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const { x, y } = getMousePos(e);
        setStartPos({ x, y });
        setEndPos({ x, y });
        setIsSelecting(true);
    };

    // Handle mouse move - update selection
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isSelecting) return;
        const { x, y } = getMousePos(e);
        setEndPos({ x, y });
    };

    // Handle mouse up - end selection
    const handleMouseUp = () => {
        setIsSelecting(false);
    };

    // Draw the current page and selection rectangle
    useEffect(() => {
        if (!canvasRef.current || pdfPages.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.src = pdfPages[currentPage];

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Draw selection rectangle
            if (isSelecting || (startPos.x !== endPos.x && startPos.y !== endPos.y)) {
                const x = Math.min(startPos.x, endPos.x);
                const y = Math.min(startPos.y, endPos.y);
                const width = Math.abs(endPos.x - startPos.x);
                const height = Math.abs(endPos.y - startPos.y);

                ctx.strokeStyle = '#3B82F6';
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 5]);
                ctx.strokeRect(x, y, width, height);

                ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
                ctx.fillRect(x, y, width, height);
            }
        };
    }, [pdfPages, currentPage, startPos, endPos, isSelecting]);

    // Crop and return the selected area
    const handleCropConfirm = () => {
        if (!canvasRef.current) return;

        const x = Math.min(startPos.x, endPos.x);
        const y = Math.min(startPos.y, endPos.y);
        const width = Math.abs(endPos.x - startPos.x);
        const height = Math.abs(endPos.y - startPos.y);

        if (width < 10 || height < 10) {
            alert('Selection too small. Please select a larger area.');
            return;
        }

        const img = new Image();
        img.src = pdfPages[currentPage];

        img.onload = () => {
            const cropCanvas = document.createElement('canvas');
            const cropCtx = cropCanvas.getContext('2d');
            if (!cropCtx) return;

            cropCanvas.width = width;
            cropCanvas.height = height;

            cropCtx.drawImage(img, x, y, width, height, 0, 0, width, height);
            const croppedImage = cropCanvas.toDataURL('image/png', 0.95);
            onCropComplete(croppedImage);
        };
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <Crop className="w-6 h-6 text-blue-600" />
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Crop Image from selected PDF</h2>
                            <p className="text-xs text-slate-500">Click and drag to select the area of the page you want to select as image </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p className="text-slate-600 font-semibold">Loading your PDF...</p>
                            </div>
                        </div>
                    ) : (
                        <div ref={containerRef} className="flex flex-col items-center">
                            <canvas
                                ref={canvasRef}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                className="border-2 border-slate-300 rounded-lg cursor-crosshair max-w-full h-auto shadow-lg"
                                style={{ maxHeight: '60vh' }}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-slate-600">Page No.:</span>
                        <select
                            value={currentPage}
                            onChange={(e) => {
                                setCurrentPage(Number(e.target.value));
                                setStartPos({ x: 0, y: 0 });
                                setEndPos({ x: 0, y: 0 });
                            }}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                        >
                            {pdfPages.map((_, idx) => (
                                <option key={idx} value={idx}>
                                    {idx + 1} of {pdfPages.length}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCropConfirm}
                            disabled={startPos.x === endPos.x || startPos.y === endPos.y}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            <Check size={18} />
                            <span>Crop & Add Image</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
