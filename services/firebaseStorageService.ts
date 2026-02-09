import { storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Upload an image to Firebase Storage in the jee-ingest-images folder
 * @param blob - Image blob to upload
 * @param filename - Unique filename for the image
 * @returns Promise with the download URL
 */
export const uploadImageToFirebase = async (blob: Blob, filename: string): Promise<string> => {
    try {
        // Create a reference to the new folder: jee-ingest-images
        const storageRef = ref(storage, `jee-ingest-images/${filename}`);

        // Upload the blob
        const snapshot = await uploadBytes(storageRef, blob);

        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        return downloadURL;
    } catch (error: any) {
        console.error('Error uploading image to Firebase:', error);
        throw new Error(`Failed to upload image: ${error.message}`);
    }
};

/**
 * Upload multiple images to Firebase Storage
 * @param images - Array of {blob, filename} objects
 * @returns Promise with array of download URLs
 */
export const uploadMultipleImages = async (
    images: { blob: Blob; filename: string }[]
): Promise<string[]> => {
    try {
        const uploadPromises = images.map(({ blob, filename }) =>
            uploadImageToFirebase(blob, filename)
        );

        const urls = await Promise.all(uploadPromises);
        return urls;
    } catch (error: any) {
        console.error('Error uploading multiple images:', error);
        throw new Error(`Failed to upload images: ${error.message}`);
    }
};
