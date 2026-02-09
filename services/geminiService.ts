import { GoogleGenerativeAI } from "@google/generative-ai";
import { Question, Option } from "../types";
import { PDFPageImage } from "./pdfService";
import { cropImageFromBase64 } from "./imageUtils";
import { log } from "./logService";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const MODEL_NAME = "gemini-2.0-flash-lite";

const QUESTION_SCHEMA = {
  description: "JEE/NEET exam question extraction",
  type: "object",
  properties: {
    questions: {
      type: "array",
      description: "Array of extracted questions",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "Full question. Wrap LaTeX in $...$." },
          type: { type: "string", enum: ["mcq", "numerical", "msq"], description: "Question type" },
          options: {
            type: "array",
            description: "Answer options for MCQ",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                isCorrect: { type: "boolean" },
                hasDiagram: { type: "boolean" },
                boundingBox: { type: "array", items: { type: "number" }, description: "[ymin, xmin, ymax, xmax]" }
              },
              required: ["text", "isCorrect"]
            }
          },
          numericalAnswer: { type: "string", description: "Answer for numerical type questions." },
          subject: { type: "string", enum: ["Physics", "Chemistry", "Mathematics"] },
          standard: { type: "string", enum: ["11th", "12th"] },
          board: { type: "string", enum: ["JEE", "NEET"] },
          chapter: { type: "string" },
          topic: { type: "string" },
          marks: { type: "integer" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          correctAnswerText: { type: "string" },
          hasDiagram: { type: "boolean" },
          boundingBox: { type: "array", items: { type: "number" }, description: "[ymin, xmin, ymax, xmax]" }
        },
        required: ["text", "type", "subject", "chapter", "topic", "correctAnswerText", "standard", "board"]
      }
    }
  },
  required: ["questions"]
};

export const parseQuestionsWithGemini = async (input: string | PDFPageImage[], sourceName: string): Promise<Question[]> => {
  if (!import.meta.env.VITE_GEMINI_API_KEY) throw new Error("Gemini API Key is missing.");


  if (typeof input === 'string') {
    return processBatch([{ text: input }], sourceName);
  }

  // To handle cross-page questions, we process in windows of 2 pages with 1 page overlap
  // This ensures a question split between Page 1 and 2 is seen in its entirety.
  const allQuestions: Question[] = [];
  const WINDOW_SIZE = 2;

  for (let i = 0; i < input.length; i += 1) {
    const chunk = input.slice(i, i + WINDOW_SIZE);
    if (chunk.length === 0) break;

    log(`Processing Multi-Page Window starting at Page ${i + 1}...`, 'info');
    try {
      const windowQuestions = await processBatch(chunk, sourceName, i + 1);
      // Simple de-duplication based on text hash/start
      for (const q of windowQuestions) {
        if (!allQuestions.find(prev => prev.text.substring(0, 50) === q.text.substring(0, 50))) {
          allQuestions.push(q);
        }
      }
    } catch (error: any) {
      log(`Window processing failed: ${error.message}`, 'error');
    }
    if (i + WINDOW_SIZE >= input.length) break;
  }

  return allQuestions;
};

async function processBatch(parts: any[], sourceName: string, pageNumber?: number): Promise<Question[]> {
  const isMultimodal = parts.some(p => typeof p !== 'string' && 'inlineData' in p);
  const currentImageBase64 = isMultimodal ? parts[0].inlineData.data : null;

  const promptText = `
   TASK:
Extract ALL JEE/NEET Exam questions from the provided input with ZERO loss of information.

CRITICAL REQUIREMENTS (NON-NEGOTIABLE):

1. QUESTION COMPLETENESS
   - Some questions may begin on one page and end on another.
   - You MUST merge all fragments into ONE complete question.
   - Never split a single question into multiple outputs.

2. QUESTION TYPES
   - MCQ: Multiple Choice Questions
   - NUMERICAL: Numerical answer / fill-in-the-blank

3. FORMATTING RULES
   - Wrap ALL mathematical expressions, equations, symbols, and formulas in $...$ (LaTeX).
   - Preserve original wording exactly; do NOT paraphrase.

4. DIAGRAM / FIGURE DETECTION (EXTREMELY IMPORTANT)

   You MUST be CONSERVATIVE.
   If there is ANY possibility that a diagram, figure, graph, plot, ray diagram, circuit, free-body diagram, geometric figure, coordinate axes, table-as-figure, reaction scheme, or visual aid exists, then:

   → set hasDiagram: true

    When unsure, ALWAYS assume hasDiagram = true (NO FALSE NEGATIVES).

   A diagram may appear:
   - Inside the question statement
   - Between lines of text
   - Beside or below options
   - On a previous or next page
   - Partially cropped or faint
   - As a graph, chart, or labeled axes
   - As ASCII-like layouts or boxed visuals
   - Referenced implicitly (e.g., "shown in the figure", "as in the diagram", "from the graph")

5. BOUNDING BOX RULES (VERY STRICT)

   If hasDiagram = true:
   - You MUST return a boundingBox: [ymin, xmin, ymax, xmax]
   - The bounding box MUST:
     - Fully enclose the ENTIRE diagram
     - Include labels, arrows, legends, axes, and captions
     - Include surrounding whitespace if unsure
   - NEVER tightly crop — prefer OVER-INCLUSION.
   - If a diagram spans multiple regions or pages:
     - Return ONE bounding box that covers the UNION of all parts.

    Partial or tight cropping is considered FAILURE.

6. OPTION-LEVEL DIAGRAMS
   - If ANY option contains or references a diagram, image, or visual structure:
     - The question-level hasDiagram MUST be true.
     - The bounding box MUST include the option diagram as well.

7. IMAGE LOSS PREVENTION CHECK (MANDATORY)

   Before finalizing output, you MUST internally verify:
   - No diagram was ignored
   - No figure reference was missed
   - No visual element was excluded from the bounding box
   - No question with a visual was marked hasDiagram: false

   If doubt exists → mark hasDiagram: true and expand bounding box.

8. AUTOMATIC CLASSIFICATION (MANDATORY)
   - board: Either "JEE" or "NEET". Infer from question style and source context. Default to "JEE" if unsure.
   - standard: Either "11th" or "12th". Infer strictly from the topic.
     - 11th: Kinematics, Laws of Motion, Work Power Energy, Thermodynamics, Equilibrium, Periodic Table, S-Block, P-Block (Gr 13,14), Hydrocarbons (Basic), Sets, Relations, Trigonometry, etc.
     - 12th: Electrostatics, Current Electricity, Magnetism, Optics, Modern Physics, Solutions, Electrochemistry, Kinetics, P-Block (Gr 15-18), Haloalkanes, Aldehydes, Calculus, Vectors, Probability, etc.

9. OUTPUT STRUCTURE (STRICT)

   For each question, return:
   {
     questionNumber,
     type: "MCQ" | "NUMERICAL",
     questionText,
     options (if MCQ),
     hasDiagram: true | false,
     boundingBox: [ymin, xmin, ymax, xmax] | null,
     board: "JEE" | "NEET",
     standard: "11th" | "12th"
   }

10. FAILURE CONDITIONS (AVOID AT ALL COSTS)
   - Missing a diagram
   - Marking hasDiagram as false when a diagram exists
   - Cropping out any part of a figure
   - Splitting one question into multiple outputs

REMEMBER:
It is ALWAYS acceptable to include extra area.
It is NEVER acceptable to miss a diagram.
  `;

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  
  const contents = {
    role: "user",
    parts: [
      ...parts,
      { text: promptText }
    ]
  };

  try {
    const response = await model.generateContent({
      contents: [contents],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA,
        temperature: 0.1,
      },
    });

    const responseText = response.response.text();
    const parsed = JSON.parse(responseText || '{"questions":[]}');
    const processed: Question[] = [];

    for (const q of (parsed.questions || [])) {
      let mainImage = null;
      if (q.hasDiagram && q.boundingBox && isMultimodal && currentImageBase64) {
        mainImage = await cropImageFromBase64(currentImageBase64, q.boundingBox);
      }

      const optionsWithCrops = await Promise.all((q.options || []).map(async (opt: any) => {
        let optImage = null;
        if (opt.hasDiagram && opt.boundingBox && isMultimodal && currentImageBase64) {
          optImage = await cropImageFromBase64(currentImageBase64, opt.boundingBox);
        }
        return { ...opt, image: optImage } as Option;
      }));

      processed.push({
        ...q,
        options: optionsWithCrops,
        source: sourceName,
        isActive: true,
        isSelected: true,
        isValid: true,
        image: mainImage,
        hasImage: !!mainImage,
        board: q.board || "JEE",
        standard: q.standard || "11th",
        section: q.type === 'numerical' ? 'Numerical' : 'Objective'
      } as Question);
    }
    return processed;
  } catch (error: any) {
    throw error;
  }
}