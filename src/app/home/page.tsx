/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QRCodeCanvas } from "qrcode.react";
import Splits from "./Splits";

export default function Home() {
  const [showSplits, setShowSplits] = useState(false);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSplits = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("Unauthorized. Please log in.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/splits", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch splits");
        }

        const data = await response.json();
        setSplits(data); // Store API response in state
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSplits();
  }, []);

  return (
    <div className="relative h-screen overflow-hidden">
      <motion.div
        className="absolute inset-0 w-full h-full flex flex-col items-center justify-around p-4 bg-white"
        animate={{ y: showSplits ? "-100%" : "0%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* First Section (Gym Tracker) */}
        <div className="text-center">
          <h1 className="text-6xl font-futura font-bold italic">GYM</h1>
          <h1 className="text-6xl font-futura font-bold italic">TRACKER</h1>
        </div>

        <Card className="flex items-center justify-center p-4">
          <QRCodeCanvas value="https://example.com" size={180} />
        </Card>

        <Button
          onClick={() => setShowSplits(true)}
          className="w-16 h-16 rounded-full text-4xl shadow-lg mb-4"
          variant="default"
        >
          ↓
        </Button>
      </motion.div>

      <motion.div
        className="absolute inset-0 w-full h-full flex flex-col items-center justify-center"
        animate={{ y: showSplits ? "0%" : "100%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {showSplits && (
          <>
            <Splits
              error={error}
              splits={splits}
              setShowSplits={setShowSplits}
            />
          </>
        )}
      </motion.div>
    </div>
  );
}
