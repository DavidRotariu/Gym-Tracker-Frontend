/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { motion } from "framer-motion";
import React, { useEffect, useState, useRef } from "react";
import { Muscle } from "./Muscle";
import { backendFetch } from "@/lib/api-client";

interface MuscleType {
  name: string;
  id: number;
  pic: string;
  nr_of_exercises: number;
  nr_of_exercises_done_today: number;
}

interface ExerciseType {
  id: string;
  name: string;
  pic: string;
  equipment: string;
  favourite: boolean;
  primary_muscle: string;
  secondary_muscles: string[];
}

interface CacheEntry {
  data: ExerciseType[];
  timestamp: number;
}

// Cache configuration - adjust duration as needed
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export const Split = ({ setSelectedSplit, setSplits, splits, currentSplit }: any) => {
  const [selectedMuscle, setSelectedMuscle] = useState<any>(null);
  const [currentMuscle, setCurrentMuscle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exercises, setExercises] = useState<ExerciseType[]>([]);

  // Use useRef to persist cache across renders without causing re-renders
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  useEffect(() => {
    const fetchSplits = async () => {
      if (!selectedMuscle) return;

      const cacheKey = `muscle-${selectedMuscle.id}`;
      const cachedData = cacheRef.current.get(cacheKey);
      const now = Date.now();

      // Check if cache exists and is still valid
      if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
        console.log(`Loading from cache: ${cacheKey}`);
        setExercises(cachedData.data);
        setLoading(false);
        setError("");
        return;
      }

      setLoading(true);
      setError("");

      try {
        console.log(`Fetching from API: ${cacheKey}`);
        const response = await backendFetch(
          `/exercises/by-muscle/${selectedMuscle.id}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch exercises");
        }

        const data = await response.json();

        // Store in cache with current timestamp
        cacheRef.current.set(cacheKey, {
          data,
          timestamp: now,
        });

        setExercises(data);
      } catch (error: any) {
        setError(error.message);
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (selectedMuscle) {
      setCurrentMuscle(selectedMuscle);
      fetchSplits();
    }
  }, [selectedMuscle]);

  const deleteSplit = async (splitId: string) => {
    try {
      const response = await backendFetch(`/splits/${splitId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete split");
      }
      setSplits(splits.filter((split: any) => split.id !== splitId));
      setSelectedSplit(null);
    } catch (error) {
      console.error("Error deleting split:", error);
    }
  };

  // Optional: Utility function to manually clear cache when needed
  const clearCache = () => {
    cacheRef.current.clear();
    console.log("Cache cleared");
  };

  if (currentSplit)
    return (
      <>
        <motion.div
          className="absolute inset-0 w-full h-full flex flex-col items-center"
          animate={{ x: selectedMuscle ? "-100%" : "0%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <div className="pb-10">
            <div className="flex justify-between">
              <button
                onClick={() => setSelectedSplit(null)}
                className="bg-[#b1b1b1] px-4 py-2 rounded-full text-black"
              >
                {`< Splits`}
              </button>
              <button
                onClick={() => deleteSplit(currentSplit.id)}
                className="bg-[#d14a3a] px-4 py-2 rounded-full text-white"
              >
                {`Delete x`}
              </button>
            </div>
            <h1 className="py-3 text-5xl text-center font-futura font-bold italic">{currentSplit.name}</h1>
            <div className="grid grid-cols-2 gap-6 mt-2 pb-2 max-h-[540px] overflow-y-auto">
              {currentSplit.muscles.map((muscle: MuscleType, index: number) => (
                <motion.div
                  key={muscle.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.3 }}
                  className="relative w-[150px] h-[200px] bg-black rounded-xl flex flex-col items-center justify-between py-3 shadow-lg"
                  onClick={() => setSelectedMuscle(muscle)}
                >
                  <div className="absolute top-1 right-0 flex mx-2">
                    {Array.from({ length: muscle.nr_of_exercises }).map((_, i) => {
                      const isCompleted = i < muscle.nr_of_exercises_done_today;
                      return (
                        <div
                          key={i}
                          className="relative w-5 h-5 ml-1 rounded-full z-2 flex items-center justify-center"
                        >
                          <img
                            src={isCompleted ? "/tick.svg" : "/untick.svg"}
                            alt="outline"
                            className="absolute w-full h-full"
                          />

                          <div
                            className={`w-4 h-4 rounded-full ${isCompleted ? "bg-[#8FE792]" : "bg-[#AF6659]"}`}
                          ></div>
                        </div>
                      );
                    })}
                  </div>
                  <img
                    src={muscle.pic.replace(/^\/uploads\//, "")}
                    alt={muscle.name}
                    className="absolute object-contain"
                  />
                  <div className="slanted-bottom rounded-b-xl flex items-center justify-end pr-3">
                    <p
                      className="text-white"
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
          </div>
        </motion.div>

        <motion.div
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center"
          animate={{ x: selectedMuscle ? "0%" : "100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <Muscle
            currentSplit={currentSplit}
            setSelectedMuscle={setSelectedMuscle}
            currentMuscle={currentMuscle}
            exercises={exercises}
            loading={loading}
            setLoading={setLoading}
            setExercises={setExercises}
          />
        </motion.div>
      </>
    );
};
