export type Subject = "Physics" | "Chemistry" | "Mathematics";
export type Difficulty = "easy" | "medium" | "hard";
export type QuestionType = "mcq" | "numerical" | "msq"; // MSQ for Multiple Select
export type Section = "Objective" | "Numerical" | "Matrix Match";
export type Board = "JEE" | "NEET";
export type Standard = "11th" | "12th";

export interface Option {
  text: string;
  isCorrect: boolean;
  image?: string | null;
  hasDiagram?: boolean;
  boundingBox?: number[];
}

export interface Question {
  _id?: string;
  text: string;
  type: QuestionType;
  options: Option[];
  subject: Subject;
  board: Board;
  standard?: Standard;
  chapter: string;
  topic: string;
  section: Section;
  marks: number;
  difficulty: Difficulty;
  correctAnswerText: string;
  numericalAnswer?: string | number; // For fill in the blanks
  source: string;
  isActive: boolean;
  isSelected: boolean; // For filtering export
  createdAt?: string;
  updatedAt?: string;
  isValid?: boolean;
  image?: string | null;
  hasImage?: boolean;
  boundingBox?: number[];
}

export enum IngestionStep {
  UPLOAD = 0,
  EXTRACT = 1,
  AI_PROCESS = 2,
  REVIEW = 3,
  COMPLETE = 4
}