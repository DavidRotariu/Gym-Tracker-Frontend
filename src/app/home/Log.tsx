/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LogProps {
  exerciseId: string; // Pass the exercise ID to associate logs
  currentMuscle: any;
  setSelectedExercise: any;
  setSelectedMuscle: any;
  lastWorkout: {
    reps: number[];
    weights: number[];
  };
}

export const Log = ({
  exerciseId,
  currentMuscle,
  setSelectedExercise,
  setSelectedMuscle,
  lastWorkout,
}: LogProps) => {
  const router = useRouter();
  const token = localStorage.getItem("token");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [logData, setLogData] = useState(lastWorkout);

  useEffect(() => {
    setLogData(lastWorkout);
  }, [lastWorkout]);

  const handleChange = (index: number, type: "reps" | "weights", value: string) => {
    setLogData((prev) => {
      const updatedArray = [...prev[type]];
      updatedArray[index] = parseFloat(value);
      return { ...prev, [type]: updatedArray };
    });
  };

  const handleLog = async () => {
    if (!token) {
      setError("Unauthorized: Please log in.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/log-workout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exercise_id: exerciseId,
          reps: logData.reps,
          weights: logData.weights,
        }),
      });

      if (!response.ok) throw new Error("Failed to log exercise");

      setSuccess(true);
      currentMuscle.nr_of_exercises_done_today++;
      setSelectedExercise(null);
      setSelectedMuscle(null);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full ">
      <Card className="p-4 rounded-xl shadow-md w-full my-2 gap-3">
        <div
          className="text-center text-gray-800 font-semibold"
          style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr 2fr" }}
        >
          <div></div>
          <div>SET 1</div>
          <div>SET 2</div>
          <div>SET 3</div>
        </div>

        <CardContent className="px-0">
          <div
            className="items-center text-center"
            style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr 2fr" }}
          >
            <div className="text-gray-700">Kg:</div>
            {logData.weights.map((weight, index) => (
              <div key={index} className="flex items-center justify-center space-x-1">
                <Input
                  type="number"
                  value={weight}
                  onChange={(e) => handleChange(index, "weights", e.target.value)}
                  className="w-16 text-center"
                />
              </div>
            ))}
          </div>

          <div
            className="items-center text-center mt-2"
            style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr 2fr" }}
          >
            <div className="text-gray-700">Reps:</div>
            {logData.reps.map((rep, index) => (
              <div key={index} className="flex items-center justify-center space-x-1">
                <Input
                  key={index}
                  type="number"
                  value={rep}
                  onChange={(e) => handleChange(index, "reps", e.target.value)}
                  className="w-16 text-center"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Button
        onClick={handleLog}
        disabled={loading}
        className="w-40 bg-black text-white py-2 rounded-md my-2"
      >
        {loading ? "Logging..." : "Log Exercise"}
      </Button>

      {success && <p className="text-green-500">Exercise logged successfully!</p>}
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};
