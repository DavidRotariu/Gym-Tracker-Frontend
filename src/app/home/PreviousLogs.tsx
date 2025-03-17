/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { differenceInDays, parseISO } from "date-fns";

interface LogEntry {
  id: string;
  exercise_id: string;
  reps: number[];
  weights: number[];
  date: string;
}

export const PreviousLogs = ({ exerciseId }: { exerciseId: string }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      const token = localStorage.getItem("token"); // ✅ Retrieve token

      if (!token) {
        setError("Unauthorized: Please log in.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/workouts/last-three?exercise_id=${exerciseId}`,
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

  const logColumns: { date: string; log: LogEntry | null }[] = logs
    .map((log) => {
      const daysAgo = differenceInDays(new Date(), parseISO(log.date));
      return {
        date: `${daysAgo} days ago`,
        log,
      };
    })
    .slice(0, 3);

  while (logColumns.length < 3) {
    logColumns.push({ date: "No Data", log: null });
  }

  return (
    <div className="bg-[#D3442F] text-black px-8 py-4 rounded-2xl w-full my-2">
      <div className="flex justify-between font-bold text-lg">
        {logColumns.map((column, index) => (
          <span key={index}>{column.date}</span>
        ))}
      </div>
      <div className="border-b border-white mb-3 mt-2"></div>

      <div className="flex justify-between text-black">
        {logColumns.map((column, index) => (
          <div key={index} className="flex flex-col items-center">
            {column.log
              ? column.log.reps.map((rep, idx) => (
                  <p key={idx}>
                    {rep}x{column.log!.weights[idx]} kg
                  </p>
                ))
              : [1, 2, 3].map((idx) => <p key={idx}>-</p>)}
          </div>
        ))}
      </div>
    </div>
  );
};
