"use client";

import { memo, useCallback, useRef, useState } from "react";
import Image from "next/image";
import {
  compressImage,
  CompressedImage,
  validateImageFile,
} from "@/lib/image-utils";

interface ChartUploadProps {
  onImageReady: (image: CompressedImage) => void;
  onClear: () => void;
  previewUrl: string | null;
  disabled?: boolean;
}

function ChartUpload({
  onImageReady,
  onClear,
  previewUrl,
  disabled = false,
}: ChartUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error ?? "파일 검증에 실패했습니다.");
        return;
      }

      setIsCompressing(true);
      try {
        const compressed = await compressImage(file);
        onImageReady(compressed);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "이미지 처리에 실패했습니다."
        );
      } finally {
        setIsCompressing(false);
      }
    },
    [onImageReady]
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void processFile(file);
      event.target.value = "";
    },
    [processFile]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled && !isCompressing) setIsDragging(true);
    },
    [disabled, isCompressing]
  );

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      if (disabled || isCompressing) return;
      const file = event.dataTransfer.files?.[0];
      if (file) void processFile(file);
    },
    [disabled, isCompressing, processFile]
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      if (disabled || isCompressing) return;
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i += 1) {
        if (items[i].kind === "file" && items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) void processFile(file);
          break;
        }
      }
    },
    [disabled, isCompressing, processFile]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (
        (event.key === "Enter" || event.key === " ") &&
        !disabled &&
        !isCompressing
      ) {
        event.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled, isCompressing]
  );

  const handleClear = useCallback(() => {
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onClear();
  }, [onClear]);

  const isInteractive = !disabled && !isCompressing;

  return (
    <div className="w-full" role="region" aria-label="차트 이미지 업로드">
      {!previewUrl ? (
        <div
          role="button"
          tabIndex={isInteractive ? 0 : -1}
          aria-label="차트 이미지를 업로드하려면 클릭하거나 파일을 끌어다 놓으세요"
          aria-disabled={!isInteractive}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onClick={() => isInteractive && inputRef.current?.click()}
          className={[
            "relative flex min-h-[260px] w-full flex-col items-center justify-center",
            "rounded-xl border-2 border-dashed outline-none transition-all duration-200 select-none",
            isDragging
              ? "scale-[1.01] border-emerald-400 bg-emerald-400/10"
              : "border-zinc-600 hover:border-emerald-500 hover:bg-zinc-800/50",
            isInteractive ? "cursor-pointer" : "cursor-default opacity-60",
          ].join(" ")}
        >
          {isCompressing ? (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center gap-3 px-6 text-center"
            >
              <svg
                className="h-8 w-8 animate-spin text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-sm text-zinc-400">이미지 압축 중...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div
                className={[
                  "flex h-14 w-14 items-center justify-center rounded-full",
                  isDragging ? "bg-emerald-400/20" : "bg-zinc-700",
                ].join(" ")}
                aria-hidden="true"
              >
                <svg
                  className="h-7 w-7 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-200">
                  {isDragging ? "여기에 놓으세요" : "차트 이미지를 업로드하세요"}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  드래그 앤 드롭 &middot; 클릭 &middot;{" "}
                  <kbd
                    className="rounded border border-zinc-600 bg-zinc-700 px-1 py-0.5 text-xs"
                    aria-label="Ctrl V 붙여넣기"
                  >
                    Ctrl+V
                  </kbd>
                </p>
                <p className="mt-2 text-xs text-zinc-600">
                  JPG &middot; PNG &middot; WEBP &middot; 최대 10MB
                </p>
              </div>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileChange}
            disabled={!isInteractive}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      ) : (
        <div className="relative w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
          <div className="relative w-full" style={{ minHeight: "240px" }}>
            <Image
              src={previewUrl}
              alt="업로드된 차트 미리보기"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
              unoptimized
              priority
            />
          </div>
          <button
            onClick={handleClear}
            disabled={disabled}
            aria-label="이미지 제거"
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur-sm transition-colors hover:border-red-500 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            제거
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-red-400">
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

export default memo(ChartUpload);
