"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Split } from "./Split";

interface MuscleType {
  name: string;
  id: number;
  pic: string;
  nr_of_exercises: number;
}

interface Split {
  id: string;
  name: string;
  pic: string;
  description: string;
  muscles: MuscleType[];
}

interface SplitsProps {
  splits: Split[];
  error?: string;
  setShowSplits: (show: boolean) => void;
}

export default function Splits({ splits, error, setShowSplits }: SplitsProps) {
  const router = useRouter();
  const [selectedSplit, setSelectedSplit] = useState<Split | null>(null);
  const [currentSplit, setCurrentSplit] = useState<Split | null>(null);

  useEffect(() => {
    if (selectedSplit) setCurrentSplit(selectedSplit);
  }, [selectedSplit]);

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
    <>
      <div className="flex flex-col items-center p-6 space-y-4">
        <motion.div
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-around p-4 bg-white"
          animate={{ x: selectedSplit ? "-100%" : "0%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <h1 className="text-5xl font-futura font-bold italic">SPLITS</h1>
          <div className="space-y-3 flex-row items-center">
            {splits.map((split) => (
              <button
                key={split.id}
                className="flex items-center justify-between w-80 px-6 py-2 bg-gray-300 rounded-full"
                onClick={() => setSelectedSplit(split)}
              >
                <div className="flex flex-col text-left">
                  <span className="text-black font-futura italic text-3xl font-medium">
                    {split.name}
                  </span>
                  <span className="text-sm text-gray-700">
                    {split.description}
                  </span>
                </div>
                <div className="w-10 h-10 flex items-center justify-center bg-gray-400 rounded-full">
                  <span className="text-black text-2xl">→</span>
                </div>
              </button>
            ))}
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
      </div>

      <motion.div
        className="absolute inset-0 w-full h-full flex flex-col items-center justify-center"
        animate={{ x: selectedSplit ? "0%" : "100%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <Split
          setSelectedSplit={setSelectedSplit}
          currentSplit={currentSplit}
          selectedSplit={selectedSplit}
        />
      </motion.div>
    </>
  );
}
