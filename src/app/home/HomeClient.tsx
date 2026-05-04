"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import Splits from "./Splits";
import QRcode from "./QRcode";
import { FaArrowDown, FaArrowLeft } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { logoutRequest } from "@/lib/api-client";

interface HomeClientProps {
  initialSplits: any[];
  initialError?: string;
  initialShowSplits: boolean;
}

export default function HomeClient({
  initialSplits,
  initialError = "",
  initialShowSplits,
}: HomeClientProps) {
  const [showSplits, setShowSplits] = useState(initialShowSplits);
  const [splits, setSplits] = useState(initialSplits);
  const [error] = useState(initialError);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logoutRequest();
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="relative min-h-[660px] overflow-hidden bg-[#EFEDEC]">
      <motion.div
        className="absolute inset-0 w-full h-full flex flex-col items-center p-4 my-10"
        animate={{ y: showSplits ? "-100%" : "0%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <div className="text-center">
          <h1 className="text-6xl font-futura font-bold italic">GYM</h1>
          <h1 className="text-6xl font-futura font-bold italic">TRACKER</h1>
        </div>

        <Card className="flex items-center justify-center p-4 border-0 shadow-none my-10 bg-[#EFEDEC]">
          <QRcode />
        </Card>

        <div
          className="w-14 h-14 absolute bottom-20 right-10 flex items-center justify-center bg-black rounded-full shadow-lg"
          onClick={() => setShowSplits(true)}
        >
          <span className="text-white text-xl">
            <FaArrowDown />
          </span>
        </div>
        <div
          className="w-14 h-14 absolute bottom-20 left-10 flex items-center justify-center bg-black rounded-full shadow-lg"
          onClick={handleLogout}
        >
          <span className="text-white text-xl">
            <FaArrowLeft />
          </span>
        </div>
      </motion.div>

      <motion.div
        className="absolute inset-0 w-full h-full flex flex-col items-center justify-center z-0 bg-[#EFEDEC]"
        animate={{ y: showSplits ? "0%" : "100%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <Splits error={error} splits={splits} setShowSplits={setShowSplits} setSplits={setSplits} />
      </motion.div>
    </div>
  );
}
