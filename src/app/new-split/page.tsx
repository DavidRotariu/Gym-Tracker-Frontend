/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function NewSplit() {
  const [splitName, setSplitName] = useState("");
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [showMuscles, setShowMuscles] = useState(false);
  const router = useRouter();

  const [muscles, setMuscles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMuscles = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/muscles");

        if (!response.ok) throw new Error("Failed to fetch muscles");

        const data = await response.json();
        setMuscles(data);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMuscles();
  }, []);

  useEffect(() => {
    if (!splitName.trim()) return;

    const timer = setTimeout(() => {
      setShouldAnimate(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [splitName]);

  useEffect(() => {
    if (!splitName.trim()) return;
    const muscleTimer = setTimeout(() => {
      setShowMuscles(true);
    }, 2000);
    return () => clearTimeout(muscleTimer);
  }, [splitName]);

  const Input = ({
    value,
    setValue,
    label,
  }: {
    value: string;
    setValue: (v: string) => void;
    label: string;
  }) => {
    return (
      <motion.div
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="input-container"
      >
        <input
          type="text"
          id={label.toLowerCase()}
          required
          value={value}
          autoFocus={label === "New Split"}
          onChange={(e) => setValue(e.target.value)}
        />
        <label htmlFor={label.toLowerCase()} className="label">
          {label}
        </label>
        <div className="underline" />
      </motion.div>
    );
  };

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6">
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full text-center"
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Split..."
          value={splitName}
          onChange={(e) => setSplitName(e.target.value)}
          className="text-5xl font-futura font-bold italic text-center bg-transparent outline-none w-full"
        />
      </motion.div>

      <div className="grid grid-cols-2 gap-6 mt-6">
        {showMuscles &&
          muscles.map(
            (muscle: { name: string; id: number; pic: string }, index) => (
              <motion.div
                key={muscle.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.3 }}
                className="w-36 h-40 bg-gray-300 rounded-lg flex flex-col items-center justify-between p-3 shadow-lg"
              >
                <div className="flex-1 flex items-center justify-center">
                  <img
                    src={muscle.pic}
                    alt={muscle.name}
                    className="w-24 h-24 object-contain"
                  />
                </div>
                <div className="w-full border-t font-futura italic font-medium border-black text-center pt-2">
                  {muscle.name}
                </div>
              </motion.div>
            )
          )}
      </div>

      <button className="mt-6 bg-black text-white px-6 py-3 rounded-full text-lg">
        Save Split
      </button>

      <button
        onClick={() => router.push("/home")}
        className="mt-3 text-gray-500 underline"
      >
        Cancel
      </button>
    </div>
  );
}
