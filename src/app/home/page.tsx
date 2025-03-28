/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import Splits from "./Splits";
import QRcode from "./QRcode";
import { Loader } from "@/components/Loader";
import { FaArrowDown, FaArrowLeft } from "react-icons/fa";
import { useRouter } from "next/navigation";

export default function Home() {
  const [showSplits, setShowSplits] = useState(false);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token"); // Remove token
    router.push("/login"); // Redirect to login page
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (Object.fromEntries(params.entries()).scroll === "true") {
        setShowSplits(true);
      }
    }
  }, []);

  useEffect(() => {
    const fetchSplits = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Unauthorized. Please log in.");
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/splits`, {
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
  if (loading)
    return (
      <div className="min-h-[660px] flex align-center justify-center">
        <div className="loaderbody">
          <Loader />
        </div>
      </div>
    );
}
