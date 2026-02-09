import JSZip from 'jszip';
import { Question } from '../types';
import { uploadImageToFirebase } from './firebaseStorageService';

/**
 * Generate a unique filename for an image
 * @param prefix - Prefix for the filename (e.g., 'question', 'option')
 * @param index - Index of the item
 * @param subIndex - Optional sub-index for nested items
 */
export const generateImageFilename = (prefix: string, index: number, subIndex?: number): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const suffix = subIndex !== undefined ? `_${subIndex}` : '';
    return `${prefix}_${index}${suffix}_${timestamp}_${random}.png`;
};

/**
 * Convert base64 data URL to blob
 */
export const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(',');
    const contentType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const byteString = atob(parts[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: contentType });
};

/**
 * Create a ZIP file containing images and JSON (with local paths)
 * @param questions - Array of questions to export
 * @param sourceName - Name of the source file
 */
export const createExportZip = async (questions: Question[], sourceName: string): Promise<Blob> => {
    const zip = new JSZip();
    const imagesFolder = zip.folder('images');

    if (!imagesFolder) {
        throw new Error('Failed to create images folder in ZIP');
    }

    // Process questions and extract images
    const exportData = questions.map((question, qIndex) => {
        const questionCopy: any = { ...question };

        // Handle main question image
        if (question.image && question.image.startsWith('data:')) {
            const filename = generateImageFilename('question', qIndex);
            const blob = base64ToBlob(question.image);
            imagesFolder.file(filename, blob);
            questionCopy.image = `images/${filename}`;
        }

        // Handle option images
        if (question.options && question.options.length > 0) {
            questionCopy.options = question.options.map((option, optIndex) => {
                const optionCopy = { ...option };

                if (option.image && option.image.startsWith('data:')) {
                    const filename = generateImageFilename('option', qIndex, optIndex);
                    const blob = base64ToBlob(option.image);
                    imagesFolder.file(filename, blob);
                    optionCopy.image = `images/${filename}`;
                }

                return optionCopy;
            });
        }

        return questionCopy;
    });

    // Add JSON file to ZIP
    const jsonString = JSON.stringify(exportData, null, 2);
    zip.file('questions.json', jsonString);

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return zipBlob;
};

/**
 * Upload images to Firebase and create JSON with Firebase URLs
 * @param questions - Array of questions to export
 * @param onProgress - Optional callback for upload progress
 */
export const uploadImagesToFirebaseAndCreateJSON = async (
    questions: Question[],
    onProgress?: (current: number, total: number) => void
): Promise<Question[]> => {
    let uploadCount = 0;

    // Count total images
    const totalImages = questions.reduce((count, q) => {
        let imageCount = q.image && q.image.startsWith('data:') ? 1 : 0;
        imageCount += q.options?.filter(opt => opt.image && opt.image.startsWith('data:')).length || 0;
        return count + imageCount;
    }, 0);

    // Process questions and upload images to Firebase
    const exportData = await Promise.all(
        questions.map(async (question, qIndex) => {
            const questionCopy: any = { ...question };

            // Handle main question image
            if (question.image && question.image.startsWith('data:')) {
                const filename = generateImageFilename('question', qIndex);
                const blob = base64ToBlob(question.image);
                const firebaseURL = await uploadImageToFirebase(blob, filename);
                questionCopy.image = firebaseURL;
                uploadCount++;
                if (onProgress) onProgress(uploadCount, totalImages);
            }

            // Handle option images
            if (question.options && question.options.length > 0) {
                questionCopy.options = await Promise.all(
                    question.options.map(async (option, optIndex) => {
                        const optionCopy = { ...option };

                        if (option.image && option.image.startsWith('data:')) {
                            const filename = generateImageFilename('option', qIndex, optIndex);
                            const blob = base64ToBlob(option.image);
                            const firebaseURL = await uploadImageToFirebase(blob, filename);
                            optionCopy.image = firebaseURL;
                            uploadCount++;
                            if (onProgress) onProgress(uploadCount, totalImages);
                        }

                        return optionCopy;
                    })
                );
            }

            return questionCopy;
        })
    );

    return exportData;
};

/**
 * Trigger download of a blob
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Upload structured data to the local MongoDB ingestion server
 * @param questions - Questions with Firebase URLs
 */
export const uploadDataToMongoDB = async (questions: Question[]): Promise<any> => {
    try {
        const response = await fetch('http://localhost:5000/api/ingest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ questions })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`MongoDB Upload Failed: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('MongoDB Upload Error:', error);
        throw error;
    }
};
