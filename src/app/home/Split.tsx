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

export const Split = ({ setSelectedSplit, selectedSplit, currentSplit }: any) => {
  const [selectedMuscle, setSelectedMuscle] = useState<any>(null);
  const [currentMuscle, setCurrentMuscle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exercises, setExercises] = useState<ExerciseType[]>([]);

  useEffect(() => {
    const fetchSplits = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/exercises/by-muscle/${selectedMuscle.id}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
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
            <button onClick={() => setSelectedSplit(null)} className="bg-gray-300 px-4 py-2 rounded-full text-black">
              {`< Splits`}
            </button>
            <h1 className="py-5 text-5xl text-center font-futura font-bold italic">{currentSplit.name}</h1>
            <div className="grid grid-cols-2 gap-6 mt-6">
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
                            className={`w-4 h-4 rounded-full ${isCompleted ? "bg-[#5AB931]" : "bg-[#AF6659]"}`}
                          ></div>
                        </div>
                      );
                    })}
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
          />
        </motion.div>
      </>
    );
};
