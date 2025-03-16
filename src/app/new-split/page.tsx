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
  const [selectedMuscles, setSelectedMuscles] = useState<
    Record<number, number>
  >({}); // Track clicks per muscle
  const router = useRouter();

  const [muscles, setMuscles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMuscles = async () => {
      try {
        const response = await fetch(`${process.env.BACKEND_URL}/muscles`);

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
      [muscleId]: (prev[muscleId] || 0) + 1, // Add a circle
    }));
  };

  const handleCircleClick = (muscleId: number) => {
    setSelectedMuscles((prev) => ({
      ...prev,
      [muscleId]: Math.max(0, (prev[muscleId] || 0) - 1), // Remove a circle, min is 0
    }));
  };

  const handleSaveSplit = async () => {
    if (!splitName.trim()) {
      alert("Please enter a split name.");
      return;
    }

    const splitData = {
      name: splitName,
      pic: "", // Add picture support later
      muscles: Object.entries(selectedMuscles).map(
        ([muscleId, nr_of_exercises]) => ({
          muscle_id: muscleId,
          nr_of_exercises,
        })
      ),
    };
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Unauthorized. Please log in.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${process.env.BACKEND_URL}/splits`, {
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
      router.push("/home"); // Redirect to homepage
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
          muscles.map(
            (muscle: { name: string; id: number; pic: string }, index) => (
              <motion.div
                key={muscle.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.3 }}
                className="w-36 h-40 bg-gray-300 rounded-lg flex flex-col items-center justify-between p-3 shadow-lg"
                onClick={() => handleMuscleClick(muscle.id)}
              >
                <div className="relative flex-1 flex items-center justify-center w-full">
                  <div className="absolute top-0 right-0 flex space-x-1">
                    {Array.from({
                      length: selectedMuscles[muscle.id] || 0,
                    }).map((_, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 bg-green-400 rounded-full border border-white cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent muscle click event
                          handleCircleClick(muscle.id);
                        }}
                      ></div>
                    ))}
                  </div>
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

      <button
        className="mt-6 bg-black text-white px-6 py-3 rounded-full text-lg"
        onClick={handleSaveSplit}
      >
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
