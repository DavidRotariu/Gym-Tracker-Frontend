"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QRCodeCanvas } from "qrcode.react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-around h-screen p-4">
      <h1 className="text-5xl font-bold">Gym Tracker</h1>

      <Card className="flex items-center justify-center p-4">
        <QRCodeCanvas value="https://example.com" size={180} />
      </Card>

      <Button
        className="w-16 h-16 rounded-full text-4xl shadow-lg mb-4"
        variant="default"
      >
        ↓
      </Button>
    </div>
  );
}
