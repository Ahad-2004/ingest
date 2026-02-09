
/**
 * Crops a specific region from a base64 string image.
 * @param base64Image The full page image in base64 format (without data prefix, or with).
 * @param box The bounding box [ymin, xmin, ymax, xmax] on a 0-1000 scale.
 * @returns Promise resolving to the cropped base64 image string.
 */
export const cropImageFromBase64 = async (base64Image: string, box: number[]): Promise<string | null> => {
    // Validate box format: [ymin, xmin, ymax, xmax]
    if (!box || !Array.isArray(box) || box.length !== 4) return null;

    return new Promise((resolve) => {
        const img = new Image();
        
        // Handle potential missing prefix if just raw bytes were passed
        const srcPrefix = base64Image.startsWith('data:') ? '' : 'data:image/jpeg;base64,';
        img.src = `${srcPrefix}${base64Image}`;

        img.onload = () => {
            try {
                const [ymin, xmin, ymax, xmax] = box;

                // Basic validation of coordinates
                if (ymin >= ymax || xmin >= xmax) {
                    console.warn("Invalid crop coordinates:", box);
                    resolve(null);
                    return;
                }

                const h = img.naturalHeight;
                const w = img.naturalWidth;

                // Convert 0-1000 scale to actual pixels
                const y1 = (ymin / 1000) * h;
                const x1 = (xmin / 1000) * w;
                const y2 = (ymax / 1000) * h;
                const x2 = (xmax / 1000) * w;

                const cropWidth = x2 - x1;
                const cropHeight = y2 - y1;

                // Add padding (approx 1% of dimension) to ensure we don't cut off edges
                const padX = w * 0.01; 
                const padY = h * 0.01;
                
                const finalX = Math.max(0, x1 - padX);
                const finalY = Math.max(0, y1 - padY);
                const finalW = Math.min(w - finalX, cropWidth + (padX * 2));
                const finalH = Math.min(h - finalY, cropHeight + (padY * 2));

                const canvas = document.createElement('canvas');
                canvas.width = finalW;
                canvas.height = finalH;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(null);
                    return;
                }
                
                // White background to handle any transparency issues
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, finalW, finalH);

                // Draw the specific region
                ctx.drawImage(img, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH);
                
                // Return high quality JPEG
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            } catch (e) {
                console.error("Cropping error:", e);
                resolve(null);
            }
        };

        img.onerror = (e) => {
            console.error("Failed to load image for cropping:", e);
            resolve(null);
        };
    });
};
