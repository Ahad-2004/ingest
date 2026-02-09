import React, { useRef, useEffect, useState } from 'react';
import { Question, Option } from '../types';
import { Check, Trash2, Image as ImageIcon, X, Hash, ListChecks, CheckSquare } from 'lucide-react';
import katex from 'katex';

interface Props {
  question: Question;
  index: number;
  onUpdate: (index: number, updated: Question) => void;
  onDelete: (index: number) => void;
  pdfFile: File | null;
  onRequestImageCrop: (callback: (croppedImage: string) => void) => void;
}

const MathDisplay: React.FC<{ text: string }> = ({ text }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Simple regex to find $...$ segments
    const parts = text.split(/(\$.*?\$)/g);
    containerRef.current.innerHTML = '';

    parts.forEach(part => {
      if (part.startsWith('$') && part.endsWith('$')) {
        const formula = part.slice(1, -1);
        const span = document.createElement('span');
        try {
          katex.render(formula, span, { throwOnError: false });
          containerRef.current?.appendChild(span);
        } catch (e) {
          containerRef.current?.appendChild(document.createTextNode(part));
        }
      } else {
        containerRef.current?.appendChild(document.createTextNode(part));
      }
    });
  }, [text]);

  return <div ref={containerRef} className="text-sm text-slate-700 leading-relaxed min-h-[1.5rem]" />;
};

export const QuestionCard: React.FC<Props> = ({ question, index, onUpdate, onDelete, pdfFile, onRequestImageCrop }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(true);

  const handleAddQuestionImage = () => {
    if (!pdfFile) {
      alert('PDF file not available for cropping');
      return;
    }
    onRequestImageCrop((croppedImage) => {
      handleFieldChange('image', croppedImage);
    });
  };

  const handleAddOptionImage = (optIndex: number) => {
    if (!pdfFile) {
      alert('PDF file not available for cropping');
      return;
    }
    onRequestImageCrop((croppedImage) => {
      handleOptionChange(optIndex, 'image', croppedImage);
    });
  };

  const handleOptionChange = (optIndex: number, field: keyof Option, value: any) => {
    const newOptions = [...question.options];
    newOptions[optIndex] = { ...newOptions[optIndex], [field]: value };
    if (field === 'isCorrect' && value === true && question.type === 'mcq') {
      newOptions.forEach((o, i) => { if (i !== optIndex) o.isCorrect = false; });
    }
    onUpdate(index, { ...question, options: newOptions });
  };

  const handleFieldChange = (field: keyof Question, value: any) => {
    onUpdate(index, { ...question, [field]: value });
  };

  return (
    <div className={`glass-card rounded-2xl p-6 mb-6 transition-all duration-300 ${!question.isSelected ? 'opacity-60 grayscale' : 'hover:shadow-glow hover:border-primary-200'}`}>

      {/* Selector & Actions */}
      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={question.isSelected}
            onChange={(e) => handleFieldChange('isSelected', e.target.checked)}
            className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
          <span className="font-bold text-slate-400 text-sm">#{index + 1}</span>
          <div className="flex items-center bg-slate-100 rounded-lg px-2 py-1">
            {question.type === 'numerical' ? <Hash size={14} className="text-slate-500 mr-1" /> : <ListChecks size={14} className="text-slate-500 mr-1" />}
            <select
              value={question.type}
              onChange={(e) => handleFieldChange('type', e.target.value)}
              className="bg-transparent border-none text-xs font-bold uppercase tracking-wider text-slate-600 focus:ring-0 p-0 cursor-pointer"
            >
              <option value="mcq">MCQ</option>
              <option value="numerical">Numerical</option>
              <option value="msq">Multiple Select</option>
            </select>
          </div>
          <select
            value={question.subject}
            onChange={(e) => handleFieldChange('subject', e.target.value)}
            className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-3 py-1 focus:outline-none"
          >
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Mathematics">Mathematics</option>
          </select>
          <select
            value={question.board || 'JEE'}
            onChange={(e) => handleFieldChange('board', e.target.value)}
            className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100 rounded-full px-3 py-1 focus:outline-none ml-2"
          >
            <option value="JEE">JEE</option>
            <option value="NEET">NEET</option>
          </select>
          <select
            value={question.standard || '11th'}
            onChange={(e) => handleFieldChange('standard', e.target.value)}
            className="text-xs font-bold bg-orange-50 text-orange-700 border border-orange-100 rounded-full px-3 py-1 focus:outline-none ml-2"
          >
            <option value="11th">11th</option>
            <option value="12th">12th</option>
          </select>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs text-blue-600 font-semibold hover:underline"
          >
            {showPreview ? "Edit Mode" : "Math Preview"}
          </button>
          <button onClick={() => onDelete(index)} className="text-slate-400 hover:text-red-500 transition">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Main Question Stem */}
      <div className="mb-4">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Question Stem (LaTeX support)</label>
        {showPreview ? (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <MathDisplay text={question.text} />
          </div>
        ) : (
          <textarea
            className="w-full text-sm font-medium p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px]"
            value={question.text}
            onChange={(e) => handleFieldChange('text', e.target.value)}
            placeholder="Type question text here. Use $...$ for LaTeX."
          />
        )}
        {/* Add/Edit Image Button */}
        <div className="mt-2">
          <button
            onClick={handleAddQuestionImage}
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition flex items-center space-x-2 border border-blue-200"
          >
            <ImageIcon size={14} />
            <span>{question.image ? 'Edit Image' : 'Add Image from PDF'}</span>
          </button>
        </div>
      </div>

      {/* Main Diagram */}
      {question.image && (
        <div className="mb-6 inline-block relative border-2 border-slate-100 rounded-xl overflow-hidden group">
          <img src={question.image} alt="Diagram" className="max-h-64 object-contain bg-white" />
          <button onClick={() => handleFieldChange('image', null)} className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition">
            <X size={14} className="text-red-500" />
          </button>
        </div>
      )}

      {/* Numerical Answer Field */}
      {question.type === 'numerical' && (
        <div className="mb-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
          <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">Numerical Answer</label>
          <input
            type="text"
            value={question.numericalAnswer || ''}
            onChange={(e) => handleFieldChange('numericalAnswer', e.target.value)}
            placeholder="Enter numerical value..."
            className="w-full p-2 border border-blue-200 rounded-lg font-mono text-lg font-bold"
          />
        </div>
      )}

      {/* Options (MCQ/MSQ only) */}
      {question.type !== 'numerical' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {question.options.map((opt, i) => (
            <div key={i} className={`flex flex-col p-3 rounded-xl border transition-all ${opt.isCorrect ? 'bg-green-50 border-green-200 ring-2 ring-green-100' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
              <div className="flex items-center space-x-3 mb-2">
                <button
                  onClick={() => handleOptionChange(i, 'isCorrect', !opt.isCorrect)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${opt.isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-300'}`}
                >
                  {opt.isCorrect && <Check size={14} />}
                </button>
                {showPreview ? (
                  <div className="flex-1 text-sm font-medium">
                    <MathDisplay text={opt.text} />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => handleOptionChange(i, 'text', e.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium border-none focus:ring-0 p-0"
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  />
                )}
              </div>
              {opt.image && (
                <div className="relative inline-block mt-2">
                  <img src={opt.image} className="h-20 rounded border bg-white object-contain" />
                  <button onClick={() => handleOptionChange(i, 'image', null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={10} /></button>
                </div>
              )}
              {/* Add Option Image Button */}
              <button
                onClick={() => handleAddOptionImage(i)}
                className="mt-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold transition flex items-center space-x-1 border border-slate-200"
              >
                <ImageIcon size={12} />
                <span>{opt.image ? 'Edit' : 'Add'} Image</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Metadata Footprint */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
        <div className="col-span-1">
          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Chapter</label>
          <input type="text" value={question.chapter} onChange={(e) => handleFieldChange('chapter', e.target.value)} className="w-full text-xs font-semibold p-2 border rounded-lg" />
        </div>
        <div className="col-span-1">
          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Topic</label>
          <input type="text" value={question.topic} onChange={(e) => handleFieldChange('topic', e.target.value)} className="w-full text-xs font-semibold p-2 border rounded-lg" />
        </div>
        <div className="col-span-1">
          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Difficulty</label>
          <select value={question.difficulty} onChange={(e) => handleFieldChange('difficulty', e.target.value)} className="w-full text-xs font-semibold p-2 border rounded-lg">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="col-span-1 text-right self-end pb-1">
          <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${question.isValid ? 'bg-slate-100 text-slate-500' : 'bg-red-50 text-red-500'}`}>
            {question.isValid ? 'VALID' : 'INVALID'}
          </span>
        </div>
      </div>
    </div>
  );
};