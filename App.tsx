import React, { useState } from 'react';
import { IngestionStep, Question } from './types';
import { StepIndicator } from './components/StepIndicator';
import { QuestionCard } from './components/QuestionCard';
import { ImageCropModal } from './components/ImageCropModal';
import { parseQuestionsWithGemini } from './services/geminiService';
import { extractTextFromPDF } from './services/pdfService';
import { log } from './services/logService';
import { createExportZip, downloadBlob, uploadImagesToFirebaseAndCreateJSON, uploadDataToMongoDB } from './services/exportService';
import { FileText, UploadCloud, Play, Database, Loader2, Download, Clock, Info, CheckCircle2 } from 'lucide-react';

function App() {
    const [currentStep, setCurrentStep] = useState<IngestionStep>(IngestionStep.UPLOAD);
    const [rawText, setRawText] = useState<string>("");
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [sourceName, setSourceName] = useState<string>("Manual Input");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const [cropCallback, setCropCallback] = useState<((croppedImage: string) => void) | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSourceName(file.name);
        setSourceFile(file);
        setError(null);
        if (file.type === 'application/pdf') {
            setIsExtracting(true);
            try {
                const text = await extractTextFromPDF(file);
                setRawText(text);
                setCurrentStep(IngestionStep.EXTRACT);
            } catch (err: any) {
                setError(err.message || "Failed to extract text from PDF.");
            } finally {
                setIsExtracting(false);
            }
        } else {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setRawText(ev.target?.result as string);
                setSourceFile(null);
                setCurrentStep(IngestionStep.EXTRACT);
            };
            reader.readAsText(file);
        }
    };

    const handleAIProcessing = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            // Always use text-only processing (no images sent to Gemini)
            const parsed = await parseQuestionsWithGemini(rawText, sourceName);
            setQuestions(parsed);
            setCurrentStep(IngestionStep.REVIEW);
        } catch (err: any) {
            setError(err.message || "Failed to process content with Gemini.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadJSON = async () => {
        setIsProcessing(true);
        try {
            // ONLY export selected questions
            const selectedQuestions = questions.filter(q => q.isSelected);

            // Upload images to Firebase and get questions with Firebase URLs
            const questionsWithFirebaseURLs = await uploadImagesToFirebaseAndCreateJSON(
                selectedQuestions,
                (current, total) => {
                    console.log(`Uploading images to Firebase: ${current}/${total}`);
                }
            );

            // Upload to MongoDB
            try {
                await uploadDataToMongoDB(questionsWithFirebaseURLs);
                console.log("Successfully uploaded to MongoDB");
            } catch (mongoErr: any) {
                console.error("MongoDB Upload Error:", mongoErr);
                alert(`Warning: MongoDB Upload failed (${mongoErr.message}). Continuing with ZIP download.`);
            }

            // Create ZIP with images (local paths) and JSON (Firebase URLs)
            const zipBlob = await createExportZip(selectedQuestions, sourceName);

            // Also create a separate JSON file with Firebase URLs
            const jsonString = JSON.stringify(questionsWithFirebaseURLs, null, 2);
            const jsonBlob = new Blob([jsonString], { type: 'application/json' });

            // Add Firebase JSON to the ZIP
            const JSZip = (await import('jszip')).default;
            const zip = await JSZip.loadAsync(zipBlob);
            zip.file('questions_firebase.json', jsonBlob);
            const finalZipBlob = await zip.generateAsync({ type: 'blob' });

            // Download the ZIP file
            const filename = `${sourceName.replace(/\.[^/.]+$/, "")}_JEE_Export.zip`;
            downloadBlob(finalZipBlob, filename);

            setTimeout(() => {
                setCurrentStep(IngestionStep.COMPLETE);
                setIsProcessing(false);
            }, 500);
        } catch (error: any) {
            setError(error.message || "Failed to create export package.");
            setIsProcessing(false);
        }
    };

    const handleRequestImageCrop = (callback: (croppedImage: string) => void) => {
        setCropCallback(() => callback);
        setShowCropModal(true);
    };

    const handleCropComplete = (croppedImage: string) => {
        if (cropCallback) {
            cropCallback(croppedImage);
        }
        setShowCropModal(false);
        setCropCallback(null);
    };

    const selectedCount = questions.filter(q => q.isSelected).length;

    return (
        <div className="min-h-screen pb-20 bg-slate-50 text-slate-900">
            <nav className="glass sticky top-0 z-50 border-b border-white/50 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-2 rounded-xl shadow-lg shadow-primary-500/30">
                            <Database className="text-white w-5 h-5" />
                        </div>
                        <span className="font-extrabold text-xl tracking-tight text-slate-800">
                            JEE <span className="text-primary-600">INGEST PRO</span>
                        </span>
                    </div>
                    <div className="hidden md:flex items-center space-x-2 text-xs font-bold text-primary-600 bg-primary-50 px-4 py-1.5 rounded-full border border-primary-100">
                        <Clock size={12} className="animate-pulse" />
                        <span>MULTIMODAL PIPELINE ACTIVE</span>
                    </div>
                </div>
            </nav>

            <StepIndicator currentStep={currentStep} />

            <main className="max-w-4xl mx-auto px-4">
                {currentStep === IngestionStep.UPLOAD && (
                    <div className="glass-card p-16 rounded-3xl text-center animate-scale-in max-w-2xl mx-auto mt-10">
                        <div className="w-24 h-24 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-float shadow-glow">
                            <UploadCloud className="w-12 h-12 text-primary-600" />
                        </div>
                        <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">
                            Structure <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-400">JEE Papers</span>
                        </h2>
                        <p className="text-slate-500 mb-10 max-w-md mx-auto text-lg leading-relaxed">
                            Advanced multimodal extraction for MCQ and Numerical papers. Supports cross-page questions and option-level diagrams.
                        </p>
                        {isExtracting ? (
                            <div className="flex flex-col items-center py-6 animate-pulse">
                                <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />
                                <span className="font-bold text-primary-700 tracking-wider text-sm">PRE-SCANNING TEXT LAYER...</span>
                            </div>
                        ) : (
                            <label className="group cursor-pointer bg-slate-900 hover:bg-primary-600 text-white px-10 py-5 rounded-2xl font-bold transition-all duration-300 shadow-xl hover:shadow-primary-500/30 flex items-center justify-center transform hover:-translate-y-1 w-full max-w-sm mx-auto overflow-hidden relative">
                                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                                <FileText className="w-6 h-6 mr-3" />
                                <span className="tracking-wide">START INGESTION</span>
                                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf" />
                            </label>
                        )}
                        {error && (
                            <div className="mt-8 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 font-bold flex items-center justify-center animate-slide-in">
                                <Info size={18} className="mr-2" />
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {currentStep === IngestionStep.EXTRACT && (
                    <div className="glass-card rounded-3xl overflow-hidden flex flex-col h-[75vh] animate-scale-in mt-6">
                        <div className="p-6 border-b border-slate-200/60 bg-white/50 flex justify-between items-center backdrop-blur-sm">
                            <div className="flex items-center space-x-3">
                                <span className="bg-primary-100 text-primary-700 p-2 rounded-lg">
                                    <FileText size={18} />
                                </span>
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-0.5">Source File</div>
                                    <div className="text-sm font-bold text-slate-800">{sourceName}</div>
                                </div>
                            </div>
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full flex items-center">
                                <CheckCircle2 size={12} className="mr-1.5" />
                                RAW TEXT EXTRACTED
                            </span>
                        </div>
                        <div className="flex-1 p-8 overflow-auto font-mono text-xs text-slate-600 leading-loose bg-white/40">
                            {rawText}
                        </div>
                        <div className="p-6 border-t border-slate-200/60 bg-white/80 flex justify-between items-center backdrop-blur-md">
                            <div className="flex items-center text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                                <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse mr-2"></div>
                                AI Pipeline Ready to Process
                            </div>
                            <button
                                onClick={handleAIProcessing}
                                disabled={isProcessing}
                                className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white px-8 py-3.5 rounded-xl font-bold flex items-center transition-all shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <><Loader2 size={20} className="animate-spin mr-3" /> ANALYZING CONTENT...</>
                                ) : (
                                    <><Play className="w-5 h-5 mr-3 fill-current" /> GENERATE QUESTIONS</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === IngestionStep.REVIEW && (
                    <div className="animate-fade-in">
                        <div className="glass p-6 rounded-2xl mb-8 flex justify-between items-center sticky top-24 z-40 shadow-glow">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Review Results</h2>
                                <div className="flex space-x-3 mt-1.5">
                                    <span className="text-slate-500 text-[10px] font-bold bg-slate-100 px-2.5 py-1 rounded-md uppercase tracking-wide border border-slate-200">
                                        {questions.length} TOTAL
                                    </span>
                                    <span className="text-primary-700 text-[10px] font-bold bg-primary-50 px-2.5 py-1 rounded-md uppercase tracking-wide border border-primary-100 flex items-center">
                                        <div className="w-1.5 h-1.5 bg-primary-500 rounded-full mr-1.5 animate-pulse"></div>
                                        {selectedCount} SELECTED FOR EXPORT
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={handleDownloadJSON}
                                disabled={selectedCount === 0 || isProcessing}
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                                <Download className="w-5 h-5 mr-2.5" />
                                EXPORT ZIP
                            </button>
                        </div>
                        <div className="space-y-6">
                            {questions.map((q, idx) => (
                                <QuestionCard
                                    key={idx}
                                    index={idx}
                                    question={q}
                                    pdfFile={sourceFile}
                                    onRequestImageCrop={handleRequestImageCrop}
                                    onUpdate={(i, updated) => {
                                        const next = [...questions];
                                        next[i] = updated;
                                        setQuestions(next);
                                    }}
                                    onDelete={(i) => setQuestions(questions.filter((_, idx) => idx !== i))}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {currentStep === IngestionStep.COMPLETE && (
                    <div className="glass-card p-16 rounded-3xl text-center max-w-lg mx-auto mt-10 animate-scale-in">
                        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <CheckCircle2 className="w-12 h-12 text-green-500" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 mb-4">Ingestion Complete!</h2>
                        <p className="text-slate-500 mb-10 text-lg">
                            Your JEE questions have been successfully structured, diagrams processed, and exported for the platform.
                        </p>
                        <button
                            onClick={() => {
                                setCurrentStep(IngestionStep.UPLOAD);
                                setQuestions([]);
                                setSourceFile(null);
                                setSourceName("Manual Input");
                                setRawText("");
                            }}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-4 rounded-xl font-bold shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 w-full"
                        >
                            PROCESS ANOTHER PAPER
                        </button>
                    </div>
                )}
            </main>

            {showCropModal && sourceFile && (
                <ImageCropModal
                    pdfFile={sourceFile}
                    onCropComplete={handleCropComplete}
                    onClose={() => {
                        setShowCropModal(false);
                        setCropCallback(null);
                    }}
                />
            )}
        </div>
    );
}

export default App;