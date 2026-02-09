
import * as pdfjsLib from 'pdfjs-dist';
import { log } from './logService';

const pdfjs = (pdfjsLib as any).default || pdfjsLib;

if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
}

export const extractTextFromPDF = async (file: File): Promise<string> => {
  log(`Starting text extraction for: ${file.name}`, 'info');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    log(`PDF loaded: ${pdf.numPages} pages found. Extracting text layer...`, 'info');

    // Parallelize text extraction for speed
    const pagePromises = Array.from({ length: pdf.numPages }, (_, i) => i + 1).map(async (pageNum) => {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as any[])
        .map((item: any) => item.str || '')
        .join(' ');
      return `--- Page ${pageNum} ---\n${pageText}\n\n`;
    });

    const results = await Promise.all(pagePromises);
    log(`Text extraction complete for ${pdf.numPages} pages.`, 'success');
    return results.join('');
  } catch (error: any) {
    log(`PDF Text Extraction Failed: ${error.message}`, 'error');
    throw new Error("Could not parse PDF text layer.");
  }
};

export interface PDFPageImage {
  inlineData: {
    data: string;
    mimeType: string;
  }
}

export const convertPDFToImages = async (file: File): Promise<PDFPageImage[]> => {
    log(`Initiating GPU-accelerated rendering for ${file.name}...`, 'info');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const images: PDFPageImage[] = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
            log(`Rendering Page ${i}/${pdf.numPages} to Canvas...`, 'info');
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 }); 
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            if (!context) throw new Error("Canvas context initialization failed");

            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context, viewport }).promise;
            
            const base64Full = canvas.toDataURL('image/jpeg', 0.85);
            const base64Data = base64Full.split(',')[1];
            
            images.push({
                inlineData: {
                    data: base64Data,
                    mimeType: 'image/jpeg'
                }
            });
            log(`Page ${i} rendered successfully.`, 'success');
        }
        return images;
    } catch (error: any) {
        log(`PDF Rendering Error: ${error.message}`, 'error');
        throw new Error("Could not convert PDF pages to images.");
    }
};
