/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();
  const [forgotText, setForgotText] = useState("Forgot your password?");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      localStorage.setItem("token", data.access_token);
      router.push("/home");
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    router.push("/signup");
  };

  const handleForgotPassword = () => {
    setForgotText("Forgot your password? Nasol");
  };

  return (
    <div className={cn("p-6 w-full max-w-md", className)} {...props}>
      <div className="flex mb-6 border-b">
        <div className="w-1/2 text-center pb-2 border-b-2 border-[#D3442F]">
          <span className="text-[#D3442F] font-fontura italic font-medium text-xl">Login</span>
        </div>
        <div className="w-1/2 text-center pb-2 cursor-pointer" onClick={handleSignUp}>
          <span className="text-[#BCBBBB] font-fontura italic font-medium text-xl">Sign up</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-gray-800 text-sm">Enter your email below to login to your account</p>

        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
            {errorMessage}
          </div>
        )}

        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md bg-[#E5B4AC] border-0 text-white placeholder-[#EFEDEC]"
            required
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md bg-[#E5B4AC] border-0 text-white placeholder-[#EFEDEC]"
            required
          />
        </div>

        <div className="flex justify-between items-center text-sm">
          <a
            href="#"
            className="text-gray-700"
            onClick={(e) => {
              e.preventDefault();
              handleForgotPassword();
            }}
          >
            {forgotText}
          </a>
          <button type="submit" className="bg-red-500 text-white px-6 py-2 rounded-md" disabled={loading}>
            {loading ? "Loading..." : "Login"}
          </button>
        </div>

        <div className="text-center mt-4">
          <a
            href="#"
            className="text-red-500"
            onClick={(e) => {
              e.preventDefault();
              handleSignUp();
            }}
          >
            {`Don't have an account? Sign up`}
          </a>
        </div>
      </form>
    </div>
  );
}
