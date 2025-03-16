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

      const data = await response.json();
      if (data.qr_code) {
        setQrCode(
          `${process.env.NEXT_PUBLIC_BASE_URL}/uploads/qrcodes/${data.qr_code}?t=${new Date().getTime()}`
        );
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/users/upload-qr`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      setMessage(data.message || "Upload successful");

      if (data.qr_code) {
        // Force update by adding a timestamp query parameter
        setQrCode(
          `${process.env.NEXT_PUBLIC_BASE_URL}/uploads/qrcodes/${data.qr_code}?t=${new Date().getTime()}`
        );
      }
    } catch (error) {
      setMessage("Error uploading QR code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-48 h-48">
      {/* Display QR Code if available */}
      {qrCode ? (
        <img
          src={qrCode}
          alt="QR Code"
          width={192}
          height={192}
          className="w-48 h-48 mt-4"
        />
      ) : (
        <div className="w-48 h-48 flex items-center justify-center border-2 border-gray-300 rounded-md">
          <p className="text-gray-500">No QR uploaded</p>
        </div>
      )}

      {/* Upload Button (always visible) */}
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
      <input
        id="fileInput"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
