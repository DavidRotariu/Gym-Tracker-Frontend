/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { Exercise } from "./Exercise";

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
}: any) => {
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [currentExercise, setCurrentExercise] = useState<any>(null);

  useEffect(() => {
    if (selectedExercise) {
      setCurrentExercise(selectedExercise);
    }
  }, [selectedExercise]);

  if (currentMuscle)
    return (
      <>
        <motion.div
          className="absolute inset-0 w-full h-full flex flex-col items-center"
          animate={{ x: selectedExercise ? "-100%" : "0%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <div className="py-6 w-full flex flex-col items-center">
            <button
              onClick={() => setSelectedMuscle(null)}
              className="bg-gray-300 px-4 py-2 rounded-full text-black mr-auto ml-6"
            >
              {`< ${currentSplit.name}`}
            </button>
            <h1 className="py-5 text-5xl text-center font-futura font-bold italic">
              {currentMuscle.name}
            </h1>

            <div className="w-full max-w-lg h-[700px] overflow-y-auto scrollbar-hide px-6">
              <div className="grid grid-cols-2 gap-6">
                {exercises.map((exercise: ExerciseType, index: number) => {
                  const isVideo = exercise.pic.endsWith(".mp4");

                  return (
                    <motion.div
                      key={exercise.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      onClick={() => setSelectedExercise(exercise)}
                      className="w-40 bg-gray-300 rounded-lg shadow-lg flex flex-col items-center overflow-hidden"
                    >
                      <div className="w-full bg-gray-500 text-white text-center py-2">
                        {exercise.name}
                      </div>

                      {/* Image / Video */}
                      <div className="w-full h-30 bg-gray-200 flex items-center justify-center">
                        {isVideo ? (
                          <video
                            src={`${process.env.NEXT_PUBLIC_BASE_URL}${exercise.pic}`}
                            className="w-full h-full object-cover"
                            autoPlay
                            loop
                          />
                        ) : (
                          <img
                            src={`${process.env.NEXT_PUBLIC_BASE_URL}${exercise.pic}`}
                            alt={exercise.name}
                            className="w-24 h-24 object-contain rounded-lg"
                          />
                        )}
                      </div>

                      {/* Equipment Name */}
                      <div className="w-full bg-gray-500 text-white text-center py-2">
                        ({exercise.equipment})
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
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
          />
        </motion.div>
      </>
    );
};
