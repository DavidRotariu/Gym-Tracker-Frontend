/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { motion } from "framer-motion";
import React from "react";

export const Exercise = ({
  setSelectedMuscle,
  currentMuscle,
  currentExercise,
  setSelectedExercise,
  exercises,
  loading,
}: any) => {
  if (currentExercise) {
    const isVideo = currentExercise.pic.endsWith(".mp4");
    return (
      <>
        <motion.div
          className="absolute inset-0 w-full h-full flex flex-col items-center"
          animate={{ x: currentExercise ? "0%" : "100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <div className="py-6 w-full flex flex-col items-center">
            <button
              onClick={() => setSelectedExercise(null)}
              className="bg-gray-300 px-4 py-2 rounded-full text-black mr-auto ml-6"
            >
              {`< ${currentMuscle.name}`}
            </button>
            <h1 className="py-5 text-5xl text-center font-futura font-bold italic">
              {currentExercise.name}
            </h1>

            <div className="w-full h-[200px] flex items-center justify-center">
              {isVideo ? (
                <video
                  src={currentExercise.pic}
                  className="w-full h-full object-contain"
                  autoPlay
                  loop
                />
              ) : (
                <img
                  src={currentExercise.pic}
                  alt={currentExercise.name}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="w-full max-w-lg h-[700px] overflow-y-auto scrollbar-hide px-6">
              <div className="grid grid-cols-2 gap-6"></div>
            </div>
          </div>
        </motion.div>
      </>
    );
  }
};
