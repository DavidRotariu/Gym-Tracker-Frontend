/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";

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
          `http://127.0.0.1:8000/workouts/last-three?exercise_id=${exerciseId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401)
            throw new Error("Unauthorized: Invalid token.");
          throw new Error("Failed to fetch logs");
        }

        const data = await response.json();
        console.log(data);
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
  if (logs.length === 0)
    return <p className="text-center text-gray-500">No previous logs found.</p>;

  // ✅ Ensure exactly 3 columns (fill missing columns with placeholders)
  const logColumns: { date: string; log: LogEntry | null }[] = logs
    .map((log) => ({
      date: formatDistanceToNow(new Date(log.date), { addSuffix: true }),
      log,
    }))
    .slice(0, 3); // Only take the last 3 logs

  // Fill up to 3 columns with empty data
  while (logColumns.length < 3) {
    logColumns.push({ date: "No Data", log: null });
  }

  return (
    <Card className="p-4 rounded-xl shadow-md w-full max-w-lg mt-4">
      <div className="grid grid-cols-3 text-center text-gray-800 font-semibold pb-2 border-b">
        {logColumns.map((column, index) => (
          <div key={index}>{column.date}</div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-2 text-center">
        {logColumns.map((column, index) => (
          <div key={index} className="space-y-2">
            {column.log ? (
              column.log.reps.map((rep, i) => (
                <div key={i} className="text-sm text-gray-700">
                  {rep}×{column.log?.weights[i]} kg
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No Data</div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
