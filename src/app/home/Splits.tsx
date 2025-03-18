/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Split } from "./Split";
import { FaArrowRight } from "react-icons/fa";
import { FaArrowUp } from "react-icons/fa";

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
  setSplits: any;
}

export default function Splits({ splits, error, setShowSplits, setSplits }: SplitsProps) {
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
      <div className="flex flex-col items-center p-6 space-y-4 ">
        <motion.div
          className="absolute inset-0 w-full h-full flex flex-col items-center  p-4"
          animate={{ x: selectedSplit ? "-100%" : "0%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <div
            className="absolute top-0 right-10 w-14 h-14 flex items-center justify-center bg-white rounded-full shadow-lg my-6"
            onClick={() => setShowSplits(false)}
          >
            <span className="text-black text-xl">
              <FaArrowUp />
            </span>
          </div>
          <h1 className="text-5xl font-futura font-bold italic mb-4 mt-4">SPLITS</h1>
          <div className="space-y-3 flex-row items-center my-4 max-h-[420px] overflow-y-auto">
            {splits.map((split) => (
              <button
                key={split.id}
                className="flex items-center justify-between w-80 pl-8 pr-3 py-2 bg-[#BCBBBB] rounded-full shadow-lg"
                onClick={() => setSelectedSplit(split)}
              >
                <div className="flex flex-col text-left">
                  <span className="text-black font-futura italic text-3xl font-medium">{split.name}</span>
                  <span className="text-sm text-[#AF6659]">{split.description}</span>
                </div>
                <div className="w-14 h-14 flex items-center justify-center bg-white rounded-full shadow-lg">
                  <span className="text-black text-xl">
                    <FaArrowRight />
                  </span>
                </div>
              </button>
            ))}
          </div>

          <Button
            onClick={() => router.push("/new-split")}
            className="bg-black text-white font-futura text-2xl px-10 py-7 rounded-full shadow-lg my-6"
          >
            New split
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
          splits={splits}
          setSplits={setSplits}
        />
      </motion.div>
    </>
  );
}
