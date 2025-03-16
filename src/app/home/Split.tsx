/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { Muscle } from "./Muscle";

interface MuscleType {
  name: string;
  id: number;
  pic: string;
  nr_of_exercises: number;
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

export const Split = ({
  setSelectedSplit,
  selectedSplit,
  currentSplit,
}: any) => {
  const [selectedMuscle, setSelectedMuscle] = useState<any>(null);
  const [currentMuscle, setCurrentMuscle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exercises, setExercises] = useState<ExerciseType[]>([]);

  useEffect(() => {
    const fetchSplits = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/exercises/by-muscle/${selectedMuscle.id}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch exercises");
        }
        const data = await response.json();
        setExercises(data);
      } catch (error: any) {
        setError(error.message);
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (selectedMuscle) {
      setCurrentMuscle(selectedMuscle);
      fetchSplits();
    }
  }, [selectedMuscle]);

  if (currentSplit)
    return (
      <>
        <motion.div
          className="absolute inset-0 w-full h-full flex flex-col items-center"
          animate={{ x: selectedMuscle ? "-100%" : "0%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <div className="py-10">
            <button
              onClick={() => setSelectedSplit(null)}
              className="bg-gray-300 px-4 py-2 rounded-full text-black"
            >
              {`< Splits`}
            </button>
            <h1 className="py-5 text-5xl text-center font-futura font-bold italic">
              {currentSplit.name}
            </h1>
            <div className="grid grid-cols-2 gap-6 mt-6">
              {currentSplit.muscles.map((muscle: MuscleType, index: number) => (
                <motion.div
                  key={muscle.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.3 }}
                  className="w-36 h-40 bg-gray-300 rounded-lg flex flex-col items-center justify-between py-3 shadow-lg"
                  onClick={() => setSelectedMuscle(muscle)}
                >
                  <div className="relative flex-1 flex items-center justify-center w-full">
                    <div className="absolute top-0 right-0 flex mx-2">
                      {Array.from({ length: muscle.nr_of_exercises }).map(
                        (_, index) => (
                          <div
                            key={index}
                            className="w-4 h-4 bg-green-400 rounded-full border border-white"
                            style={{ marginRight: index }}
                          ></div>
                        )
                      )}
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
          />
        </motion.div>
      </>
    );
};
