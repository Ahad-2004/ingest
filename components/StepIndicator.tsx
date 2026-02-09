import React from 'react';
import { IngestionStep } from '../types';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface Props {
  currentStep: IngestionStep;
}

const steps = [
  { id: IngestionStep.UPLOAD, label: "Upload Source" },
  { id: IngestionStep.EXTRACT, label: "Text Extraction" },
  { id: IngestionStep.AI_PROCESS, label: "AI Parsing" },
  { id: IngestionStep.REVIEW, label: "Review & Validate" },
  { id: IngestionStep.COMPLETE, label: "Ingestion" },
];

export const StepIndicator: React.FC<Props> = ({ currentStep }) => {
  return (
    <div className="w-full py-8 mb-4">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center justify-between relative">
          {/* Background Line */}
          <div className="absolute top-[1.2rem] left-0 right-0 h-1 bg-slate-200 rounded-full -z-10 mx-10"></div>

          {/* Active Progress Line */}
          <div
            className="absolute top-[1.2rem] left-0 h-1 bg-primary-500 rounded-full -z-10 transition-all duration-500 ease-out mx-10"
            style={{ width: `${(Math.min(currentStep, 5) / 4) * 100}%` }}
          ></div>

          {steps.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div key={step.id} className="flex flex-col items-center relative z-10">
                <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300
                    ${isCompleted ? 'bg-primary-600 border-primary-100 text-white shadow-lg shadow-primary-500/30' :
                    isCurrent ? 'bg-white border-primary-500 text-primary-600 shadow-glow scale-110' :
                      'bg-slate-50 border-slate-200 text-slate-300'}
                 `}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isCurrent ? (
                    <div className="w-3 h-3 bg-primary-600 rounded-full animate-pulse" />
                  ) : (
                    <span className="text-xs font-bold">{index + 1}</span>
                  )}
                </div>
                <span className={`
                    mt-3 text-[10px] font-bold tracking-widest uppercase transition-colors duration-300 absolute -bottom-6 w-32 text-center
                    ${isCurrent ? 'text-primary-600' : isCompleted ? 'text-slate-600' : 'text-slate-300'}
                 `}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};