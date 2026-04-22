/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, useEffect } from "react";
import { FaUpload } from "react-icons/fa";
import { backendFetch, resolveBackendMediaUrl } from "@/lib/api-client";

const TARGET_UPLOAD_SIZE_BYTES = 900 * 1024;
const MAX_IMAGE_DIMENSION = 1200;
const JPEG_QUALITY_LEVELS = [0.92, 0.82, 0.72, 0.6];

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read the selected image."));
      image.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not optimize the selected image."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

async function optimizeImageForUpload(file: File) {
  if (!file.type.startsWith("image/") || file.size <= TARGET_UPLOAD_SIZE_BYTES) {
    return file;
  }

  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longestSide : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not optimize the selected image.");
  }

  context.drawImage(image, 0, 0, width, height);

  let optimizedBlob: Blob | null = null;

  for (const quality of JPEG_QUALITY_LEVELS) {
    const blob = await canvasToBlob(canvas, quality);
    optimizedBlob = blob;

    if (blob.size <= TARGET_UPLOAD_SIZE_BYTES) {
      break;
    }
  }

  if (!optimizedBlob) {
    throw new Error("Could not optimize the selected image.");
  }

  const optimizedName = file.name.replace(/\.[^.]+$/, "") || "qr-code";
  return new File([optimizedBlob], `${optimizedName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export default function UploadQR() {
  const [message, setMessage] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // Upload progress state

  useEffect(() => {
    fetchQrCode();
  }, []);

  const fetchQrCode = async () => {
    try {
      const response = await backendFetch(`/users/get-qr`, {
        method: "GET",
      });

      if (!response.ok) {
        if (response.status !== 404) {
          // Ignore 404 (no QR code found)
          console.error("Error fetching QR code:", await response.text());
        }
        return;
      }

      const data = await response.json();
      if (data.qr_code_url) {
        setQrCode(resolveBackendMediaUrl(data.qr_code_url));
      }
    } catch (error) {
      console.error("Error fetching QR code:", error);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      await handleUpload(selectedFile); // Automatically upload
      e.target.value = "";
    }
  };

  const handleUpload = async (selectedFile: File) => {
    if (!selectedFile) {
      setMessage("Please select a file");
      return;
    }

    let fileToUpload = selectedFile;

    try {
      fileToUpload = await optimizeImageForUpload(selectedFile);
    } catch (error: any) {
      setMessage(error.message || "Could not process the selected image.");
      return;
    }

    const formData = new FormData();
    formData.append("file", fileToUpload);
    setLoading(true); // Show loading state
    setMessage("");

    try {
      const response = await backendFetch(`/users/upload-qr`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error(
            `Image is still too large after optimization (${formatFileSize(fileToUpload.size)}). Try a tighter crop or a screenshot.`,
          );
        }

        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();
      setMessage(
        fileToUpload !== selectedFile
          ? `Upload successful. Reduced image from ${formatFileSize(selectedFile.size)} to ${formatFileSize(fileToUpload.size)}.`
          : data.message || "Upload successful",
      );

      if (data.qr_code_url) {
        setQrCode(resolveBackendMediaUrl(data.qr_code_url));
      } else {
        // Wait a moment for backend to process, then fetch
        await new Promise((resolve) => setTimeout(resolve, 500));
        await fetchQrCode();
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      setMessage(`Error uploading QR code: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-64 h-64">
      {qrCode ? (
        <img
          src={qrCode}
          alt="QR Code"
          width={192}
          height={192}
          className="w-64 h-64 mt-4"
          // Add cache-busting parameter to force reload of the image
          onError={(e) => {
            // If image fails to load, try again with a timestamp parameter
            const target = e.target as HTMLImageElement;
            if (!target.src.includes("t=")) {
              target.src = `${qrCode}?t=${new Date().getTime()}`;
            }
          }}
        />
      ) : (
        <div className="w-64 h-64 flex items-center justify-center border-2 border-gray-300 rounded-md">
          <p className="text-gray-500">No QR uploaded</p>
        </div>
      )}

      <label
        htmlFor="fileInput"
        className="absolute -bottom-4 right-0 bg-blue-500 text-white p-3 rounded-full shadow-md cursor-pointer hover:bg-blue-600 transition"
      >
        {loading ? (
          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
        ) : (
          <FaUpload size={16} />
        )}
      </label>
      <input id="fileInput" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {message && <div className="mt-4 text-sm text-center">{message}</div>}
    </div>
  );
}
