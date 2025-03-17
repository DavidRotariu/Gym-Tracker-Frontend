/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QRCodeCanvas } from "qrcode.react";
import Splits from "./Splits";
import QRcode from "./QRcode";
import { Loader } from "@/components/Loader";

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
        setSplits(data);
      } catch (error: any) {
        setError(error.message);
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchSplits();
  }, []);

  if (!loading)
    return (
      <div className="relative h-screen overflow-hidden bg-[#EFEDEC]">
        <motion.div
          className="absolute inset-0 flex flex-col items-center p-4 my-16 z-0"
          animate={{ y: showSplits ? "-100%" : "0%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <div className="text-center">
            <h1 className="text-6xl font-futura font-bold italic">GYM</h1>
            <h1 className="text-6xl font-futura font-bold italic">TRACKER</h1>
          </div>

          <Card className="flex items-center justify-center p-4 border-0 shadow-none my-16 bg-[#EFEDEC]">
            <QRcode />
          </Card>

          <Button
            className="w-16 h-16 rounded-full text-4xl shadow-lg my-8"
            variant="default"
            onClick={() => setShowSplits(true)}
          >
            ↓
          </Button>
        </motion.div>
        <motion.div
          className="w-full h-full items-center justify-center z-0 bg-[#EFEDEC]"
          animate={{ y: showSplits ? "0%" : "100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <Splits error={error} splits={splits} setShowSplits={setShowSplits} />
        </motion.div>
      </div>
    );
  if (loading)
    return (
      <div className="flex align-center justify-center">
        <div className="loaderbody">
          <Loader />
        </div>
      </div>
    );
}
