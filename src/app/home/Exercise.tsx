/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import React from "react";
import { Log } from "./Log";
import { PreviousLogs } from "./PreviousLogs";

export const Exercise = ({
  setSelectedMuscle,
  currentMuscle,
  currentExercise,
  setSelectedExercise,
  exercises,
  loading,
  currentSplit,
}: any) => {
  if (currentExercise) {
    const isVideo = currentExercise.pic.endsWith(".mp4");
    const src = currentExercise.pic.replace(/^\/uploads\//, "");
    return (
      <>
        <motion.div
          className="absolute inset-0 w-full h-screen flex flex-col items-center px-8"
          animate={{ x: currentExercise ? "0%" : "100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <div className=" w-full flex flex-col items-center">
            <button
              onClick={() => setSelectedExercise(null)}
              className="bg-gray-300 px-4 py-2 rounded-full text-black mr-auto"
            >
              {`< ${currentMuscle.name}`}
            </button>
            <h1 className="pb-2 pt-2 text-4xl text-center font-futura font-bold italic">
              {currentExercise.name}
            </h1>

            <div className="h-[150px] w-full flex items-center justify-center my-2">
              {isVideo ? (
                <video src={src} className="w-full h-full object-cover" autoPlay loop playsInline />
              ) : (
                <img src={src} alt={currentExercise.name} className="w-full h-full object-contain" />
              )}
            </div>
            <Log
              exerciseId={currentExercise.id}
              currentMuscle={currentMuscle}
              setSelectedExercise={setSelectedExercise}
              setSelectedMuscle={setSelectedMuscle}
            />
            <PreviousLogs
              exerciseId={currentExercise.id}
              setSelectedExercise={setSelectedExercise}
              setSelectedMuscle={setSelectedMuscle}
            />
          </div>
        </motion.div>
      </>
    );
  }
};
