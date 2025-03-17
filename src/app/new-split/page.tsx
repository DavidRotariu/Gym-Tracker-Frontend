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
  const [selectedMuscles, setSelectedMuscles] = useState<Record<number, number>>({}); // Track clicks per muscle
  const router = useRouter();

  const [muscles, setMuscles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMuscles = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/muscles`);

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

  const handleMuscleClick = (muscleId: number) => {
    setSelectedMuscles((prev) => ({
      ...prev,
      [muscleId]: (prev[muscleId] || 0) + 1,
    }));
  };

  const handleCircleClick = (muscleId: number) => {
    setSelectedMuscles((prev) => ({
      ...prev,
      [muscleId]: Math.max(0, (prev[muscleId] || 0) - 1),
    }));
  };

  const handleSaveSplit = async () => {
    if (!splitName.trim()) {
      alert("Please enter a split name.");
      return;
    }

    const splitData = {
      name: splitName,
      pic: "",
      muscles: Object.entries(selectedMuscles)
        .filter(([_, nr_of_exercises]) => nr_of_exercises !== 0) // Filter out exercises with 0 reps
        .map(([muscleId, nr_of_exercises]) => ({
          muscle_id: muscleId,
          nr_of_exercises,
        })),
    };
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Unauthorized. Please log in.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/splits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(splitData),
      });

      if (!response.ok) {
        throw new Error("Failed to save split");
      }

      const result = await response.json();
      router.push("/home");
    } catch (error: any) {
      alert("Error saving split: " + error.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6">
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full text-center"
      >
        <input
          type="text"
          placeholder="Split..."
          value={splitName}
          onChange={(e) => setSplitName(e.target.value)}
          className="text-5xl font-futura font-bold italic text-center bg-transparent outline-none w-full"
        />
      </motion.div>

      <div className="grid grid-cols-2 gap-6 mt-6">
        {showMuscles &&
          muscles.map((muscle: { name: string; id: number; pic: string }, index) => (
            <motion.div
              key={muscle.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.3 }}
              className="relative w-[150px] h-[200px] bg-black rounded-xl flex flex-col items-center justify-between py-3 shadow-lg"
              onClick={() => handleMuscleClick(muscle.id)}
            >
              <div className="absolute top-1 right-0 flex mx-2">
                {Array.from({
                  length: selectedMuscles[muscle.id] || 0,
                }).map((_, i) => (
                  <div
                    key={i}
                    className="relative w-5 h-5 ml-1 rounded-full z-2 flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCircleClick(muscle.id);
                    }}
                  >
                    <img src={"/untick.svg"} alt="outline" className="absolute w-full h-full" />
                    <div className="w-4 h-4 rounded-full bg-[#AF6659]"></div>
                  </div>
                ))}
              </div>
              <img
                src={`${process.env.NEXT_PUBLIC_BASE_URL}${muscle.pic}`}
                alt={muscle.name}
                className="absolute object-contain"
              />
              <div className="slanted-bottom rounded-b-xl  flex items-center justify-end pr-3">
                <p
                  className="text-white "
                  style={{
                    fontFamily: "Futura",
                    fontWeight: 500,
                    fontSize: 22,
                  }}
                >
                  {muscle.name}
                </p>
              </div>
            </motion.div>
          ))}
      </div>

      <button
        className="mt-6 bg-black text-white px-6 py-3 rounded-full text-lg"
        onClick={handleSaveSplit}
        disabled={Object.keys(selectedMuscles).length === 0}
      >
        Save Split
      </button>

      <button onClick={() => router.push("/home")} className="mt-3 text-gray-500 underline">
        Cancel
      </button>
    </div>
  );
}
