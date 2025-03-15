/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Splits({ splits, error, setShowSplits }: any) {
  const router = useRouter();
  const [selectedSplit, setSelectedSplit] = useState(null);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-lg text-red-500">{error}</p>
        <button
          onClick={() => router.push("/login")}
          className="bg-gray-300 text-black px-4 py-2 rounded-full mt-4"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-6 space-y-4">
      <motion.div
        className="absolute inset-0 w-full h-full flex flex-col items-center justify-around p-4 bg-white"
        animate={{ x: selectedSplit ? "-100%" : "0%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <h1 className="text-5xl font-futura font-bold italic">SPLITS</h1>
        <div className="w-full max-w-md space-y-3">
          {splits.map(
            (
              split: {
                id: string;
                name: string;
                muscles: string;
                description: string;
              },
              index: number
            ) => (
              <button
                key={index}
                className="flex items-center justify-between w-80 px-6 py-2 bg-gray-300 rounded-full"
              >
                <div className="flex flex-col text-left">
                  <span className="text-black font-futura italic text-3xl font-medium">
                    {split.name}
                  </span>
                  <span className="text-sm text-gray-700">
                    {split.description}
                  </span>
                </div>
                <div
                  className="w-10 h-10 flex items-center justify-center bg-gray-400 rounded-full"
                  onClick={() => setSelectedSplit(split)}
                >
                  <span className="text-black text-2xl">→</span>
                </div>
              </button>
            )
          )}
        </div>

        <button
          onClick={() => router.push("/new-split")}
          className="bg-gray-300 text-black font-futura text-2xl px-6 py-2 rounded-full mt-4"
        >
          New split
        </button>
        <Button
          onClick={() => setShowSplits(false)}
          className="mt-6 w-16 h-16 rounded-full text-2xl shadow-lg"
          variant="outline"
        >
          ↑
        </Button>
      </motion.div>

      <motion.div
        className="absolute inset-0 w-full h-full flex flex-col items-center justify-center"
        animate={{ x: selectedSplit ? "0%" : "100%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <>
          <button
            onClick={() => setSelectedSplit(null)}
            className="bg-gray-300 px-4 py-2 rounded-full text-black"
          >
            ← Back
          </button>
          <h2 className="text-4xl font-futura italic font-bold">
            {selectedSplit?.name}
          </h2>
          <p className="text-lg text-gray-700">{selectedSplit?.description}</p>
        </>
      </motion.div>
    </div>
  );
}
