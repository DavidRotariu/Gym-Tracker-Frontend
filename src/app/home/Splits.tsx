/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export default function Splits() {
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchSplits = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("Unauthorized. Please log in.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/splits", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch splits");
        }

        const data = await response.json();
        setSplits(data); // Store API response in state
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSplits();
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-lg text-red-500">{error}</p>
        <button
          onClick={() => router.push("/login")}
          className="bg-gray-300 text-black px-4 py-2 rounded-full mt-4"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-6 space-y-4">
      <h1 className="text-2xl font-semibold">SPLITS</h1>

      <div className="w-full max-w-md space-y-3">
        {splits.map(
          (split: { name: string; muscles: string }, index: number) => (
            <Card
              key={index}
              className="flex flex-row items-center justify-between bg-gray-200 p-4 rounded-full"
            >
              <div className="flex flex-col px-2">
                <h2 className="text-lg font-semibold">{split.name}</h2>
                <p className="text-sm text-gray-600">{split.muscles}</p>
              </div>
              <div className="p-3 bg-gray-300 rounded-full">
                <ArrowRight className="h-5 w-5 text-gray-700" />
              </div>
            </Card>
          )
        )}
      </div>

      <button
        onClick={() => router.push("/new-split")}
        className="bg-gray-300 text-black px-4 py-2 rounded-full mt-4"
      >
        New split
      </button>
    </div>
  );
}
