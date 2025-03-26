/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { addHours, differenceInDays, parseISO } from "date-fns";

interface LogEntry {
  id: string;
  exercise_id: string;
  reps: number[];
  weights: number[];
  date: string;
}

export const PreviousLogs = ({
  exerciseId,
  setSelectedExercise,
  setSelectedMuscle,
  setLastWorkout,
}: {
  exerciseId: string;
  setSelectedExercise: any;
  setSelectedMuscle: any;
  setLastWorkout: any;
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("Unauthorized: Please log in.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/workouts/by-exercise?exercise_id=${exerciseId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          if (response.status === 401) throw new Error("Unauthorized: Invalid token.");
          throw new Error("Failed to fetch logs");
        }

        const data = await response.json();
        setLogs(data);
        setLastWorkout({
          reps: data[0].reps,
          weights: data[0].weights,
        });
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [exerciseId]);

  if (loading) return <p className="text-center text-lg">Loading...</p>;
  if (error) return <p className="text-center text-red-500">{error}</p>;
  if (logs.length === 0) return <p className="text-center text-gray-500">No previous logs found.</p>;

  const deleteWorkout = async (workoutId: string) => {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Unauthorized: Please log in.");
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/workouts?workout_id=${workoutId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("Unauthorized: Invalid token.");
        if (response.status === 404) throw new Error("Workout not found.");
        throw new Error("Failed to delete workout");
      }
      setSelectedExercise(null);
      setSelectedMuscle(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto flex space-x-4 p-1">
        {logs.map((log, index) => {
          const daysAgo = differenceInDays(addHours(new Date(), 2), parseISO(log.date));
          return (
            <div
              key={index}
              className="relative bg-[#D3442F] text-white px-1 py-1 rounded-2xl w-[120px] flex-shrink-0 shadow-xl"
            >
              <button
                onClick={() => deleteWorkout(log.id)}
                className="absolute top-0 right-2 text-white font-bold text-md cursor-pointer hover:text-gray-200"
              >
                x
              </button>
              <div className="font-bold text-md text-center italic">
                {daysAgo != 0 ? `${daysAgo} days ago` : "Today"}
              </div>
              <div className="border-b border-white my-1 mx-4"></div>
              <div className="flex flex-col items-center">
                {log.reps.map((rep, idx) => (
                  <p key={idx}>{`${rep}x ${log.weights[idx]} kg`}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
