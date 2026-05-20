export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const MAX_DIMENSION = 2048;
const COMPRESS_QUALITY = 0.85;
const THUMB_MAX_DIM = 120;
const THUMB_QUALITY = 0.5;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: File): ValidationResult {
  const isAllowed = ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType);
  if (!isAllowed) {
    return {
      valid: false,
      error: "JPG, PNG, WEBP 파일만 업로드할 수 있습니다.",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `파일 크기는 ${MAX_FILE_SIZE_MB}MB 이하여야 합니다. (현재: ${sizeMB}MB)`,
    };
  }

  return { valid: true };
}

export interface CompressedImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
  thumbnailDataUrl: string;
  originalSizeKB: number;
  compressedSizeKB: number;
  wasCompressed: boolean;
}

export function compressImage(file: File): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION;

      if (needsResize) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context를 생성할 수 없습니다."));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const outputMime = file.type === "image/png" ? "image/png" : "image/jpeg";
      const quality = outputMime === "image/jpeg" ? COMPRESS_QUALITY : undefined;

      const thumbRatio = Math.min(THUMB_MAX_DIM / width, THUMB_MAX_DIM / height);
      const thumbW = Math.max(1, Math.round(width * thumbRatio));
      const thumbH = Math.max(1, Math.round(height * thumbRatio));
      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = thumbW;
      thumbCanvas.height = thumbH;
      const thumbCtx = thumbCanvas.getContext("2d");
      if (thumbCtx) {
        thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);
      }
      const thumbnailDataUrl = thumbCanvas.toDataURL("image/jpeg", THUMB_QUALITY);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지 압축에 실패했습니다."));
            return;
          }

          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result;

            if (typeof dataUrl !== "string") {
              reject(new Error("파일 읽기에 실패했습니다."));
              return;
            }

            const base64 = dataUrl.split(",")[1];
            if (!base64) {
              reject(new Error("base64 변환에 실패했습니다."));
              return;
            }

            resolve({
              base64,
              mimeType: outputMime,
              previewUrl: URL.createObjectURL(blob),
              thumbnailDataUrl,
              originalSizeKB: Math.round(file.size / 1024),
              compressedSizeKB: Math.round(blob.size / 1024),
              wasCompressed: needsResize || blob.size < file.size,
            });
          };
          reader.onerror = () => reject(new Error("파일 읽기에 실패했습니다."));
          reader.readAsDataURL(blob);
        },
        outputMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 불러올 수 없습니다. 파일이 손상되었을 수 있습니다."));
    };

    img.src = objectUrl;
  });
}
