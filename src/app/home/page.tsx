"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QRCodeCanvas } from "qrcode.react";
import Splits from "./Splits";

export default function Home() {
  const [showSplits, setShowSplits] = useState(false);

  return (
    <div className="relative h-screen overflow-hidden">
      <motion.div
        className="absolute inset-0 w-full h-full flex flex-col items-center justify-around p-4 bg-white"
        animate={{ y: showSplits ? "-100%" : "0%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* First Section (Gym Tracker) */}
        <h1 className="text-5xl font-bold">Gym Tracker</h1>

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
        <Splits />

        <Button
          onClick={() => setShowSplits(false)}
          className="mt-6 w-16 h-16 rounded-full text-2xl shadow-lg"
          variant="outline"
        >
          ↑
        </Button>
      </motion.div>
    </div>
  );
}
