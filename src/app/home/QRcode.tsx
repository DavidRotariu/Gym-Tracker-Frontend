/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { useState, useEffect } from "react";
import { FaUpload } from "react-icons/fa";

export default function UploadQR() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // Upload progress state

  useEffect(() => {
    fetchQrCode();
  }, []);

  const fetchQrCode = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/users/get-qr`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
        // Use the full URL directly from the API response
        setQrCode(data.qr_code_url);
      }
    } catch (error) {
      console.error("Error fetching QR code:", error);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      await handleUpload(selectedFile); // Automatically upload
    }
  };

  const handleUpload = async (selectedFile: File) => {
    if (!selectedFile) {
      setMessage("Please select a file");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    const formData = new FormData();
    formData.append("file", selectedFile);
    setLoading(true); // Show loading state

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/users/upload-qr`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();
      setMessage(data.message || "Upload successful");

      if (data.qr_code_url) {
        // Use the full URL directly from the API response
        setQrCode(data.qr_code_url);
      }

      // Refresh the display
      fetchQrCode();
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
