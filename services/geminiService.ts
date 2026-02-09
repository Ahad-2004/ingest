import { GoogleGenerativeAI } from "@google/generative-ai";
import { Question } from "../types";
import { log } from "./logService";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const MODEL_NAME = "gemini-2.0-flash-lite";

/**
 * Parse questions from text using Gemini (text-only, no images)
 * Users will manually crop images themselves
 */
export const parseQuestionsWithGemini = async (textContent: string, sourceName: string): Promise<Question[]> => {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing.");
  }

  log('Processing text with Gemini...', 'info');

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const prompt = `
Extract ALL questions from the provided JEE/NEET exam paper text.

CRITICAL INSTRUCTIONS:

1. QUESTION COMPLETENESS
   - Merge any question fragments that span multiple sections into ONE complete question
   - NEVER split a single question into multiple outputs

2. QUESTION TYPES
   - MCQ: Multiple Choice Questions (single correct answer)
   - MSQ: Multiple Select Questions (multiple correct answers)
   - NUMERICAL: Numerical answer questions

3. FORMATTING
   - Wrap ALL mathematical expressions, equations, symbols in $...$ (LaTeX format)
   - Examples: $x^2$, $\\frac{1}{2}$, $\\int_0^1$, $\\Delta H$
   - Preserve exact wording

4. AUTOMATIC CLASSIFICATION
   - board: "JEE" or "NEET" (infer from content, default "JEE")
   - standard: "11th" or "12th" (infer from topic)
     * 11th: Kinematics, Laws of Motion, Thermodynamics, Equilibrium, Periodic Table, Hydrocarbons, Sets, Trigonometry
     * 12th: Electrostatics, Magnetism, Optics, Modern Physics, Solutions, Electrochemistry, Aldehydes, Calculus, Vectors

5. IMAGES
   - Set hasImage: false for ALL questions (users will add images manually)
   - Do NOT include bounding boxes or image references

6. OUTPUT FORMAT (JSON)
Return a JSON array of questions with this structure:
{
  "questions": [
    {
      "text": "Question text with $LaTeX$ formulas",
      "type": "mcq" | "msq" | "numerical",
      "options": [{ "text": "Option text", "isCorrect": true|false }],
      "subject": "Physics" | "Chemistry" | "Mathematics",
      "board": "JEE" | "NEET",
      "standard": "11th" | "12th",
      "chapter": "Chapter name",
      "topic": "Topic name",
      "marks": 4,
      "difficulty": "easy" | "medium" | "hard",
      "correctAnswerText": "Explanation of correct answer",
      "numericalAnswer": "Answer for numerical questions"
    }
  ]
}

TEXT TO PROCESS:
${textContent}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    let jsonText = text;
    if (text.includes('```json')) {
      jsonText = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      jsonText = text.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(jsonText);
    const questions: Question[] = (parsed.questions || []).map((q: any) => ({
      ...q,
      source: sourceName,
      isActive: true,
      isSelected: true,
      isValid: true,
      image: null,
      hasImage: false,
      board: q.board || "JEE",
      standard: q.standard || "12th",
      section: q.type === 'numerical' ? 'Numerical' : 'Objective',
      options: q.options || []
    }));

    log(`Extracted ${questions.length} questions`, 'info');
    return questions;

  } catch (error: any) {
    log(`Gemini API Error: ${error.message}`, 'error');
    throw new Error(`Failed to process with Gemini: ${error.message}`);
  }
};