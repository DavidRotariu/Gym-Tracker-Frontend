/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { Exercise } from "./Exercise";
import { Loader } from "@/components/Loader";
import ExerciseCard from "./ExerciseCard";

interface ExerciseType {
  id: string;
  name: string;
  pic: string;
  equipment: string;
  favourite: boolean;
  primary_muscle: string;
  secondary_muscles: string[];
}

export const Muscle = ({
  currentSplit,
  setSelectedMuscle,
  currentMuscle,
  exercises,
  loading,
  setLoading,
  setExercises,
}: any) => {
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [currentExercise, setCurrentExercise] = useState<any>(null);

  useEffect(() => {
    if (selectedExercise) {
      setCurrentExercise(selectedExercise);
    }
  }, [selectedExercise]);

  if (currentMuscle) {
    return (
      <>
        <motion.div
          className="absolute inset-0 w-full h-full flex flex-col items-center"
          animate={{ x: selectedExercise ? "-100%" : "0%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <div className="pb-6 w-full flex flex-col items-center">
            <button
              onClick={() => setSelectedMuscle(null)}
              className="bg-gray-300 px-4 py-2 rounded-full text-black mr-auto ml-6"
            >
              {`< ${currentSplit.name}`}
            </button>
            <h1 className="py-3 text-5xl text-center font-futura font-bold italic">{currentMuscle.name}</h1>

            {!loading ? (
              <div className="w-full mt-2 px-6 grid grid-cols-2 gap-6 h-[540px] overflow-y-auto pb-2">
                {exercises.map((exercise: ExerciseType, index: number) => {
                  const isVideo = exercise.pic.endsWith(".mp4");
                  const name = exercise.name.replace(/\s*\(.*?\)\s*/g, " ").trim();
                  return (
                    <ExerciseCard
                      key={index}
                      exercise={exercise}
                      index={index}
                      isVideo={isVideo}
                      selectedExercise={selectedExercise}
                      setSelectedExercise={setSelectedExercise}
                      setExercises={setExercises}
                      setLoading={setLoading}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="pb-40 flex align-center justify-center loaderbody">
                <Loader />
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center"
          animate={{ x: selectedExercise ? "0%" : "100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <Exercise
            setSelectedExercise={setSelectedExercise}
            currentMuscle={currentMuscle}
            selectedExercise={selectedExercise}
            currentExercise={currentExercise}
            currentSplit={currentSplit}
            setSelectedMuscle={setSelectedMuscle}
          />
        </motion.div>
      </>
    );
  }
};
