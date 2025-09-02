"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWebRTC } from "@/lib/webrtc";

export function ReceiverFlow() {
  const [sessionCode, setSessionCode] = useState("");
  const { startConnection }. = useWebRTC();

  const handleConnect = () => {
    if (sessionCode) {
      startConnection(sessionCode);
    }
  };

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 lg:p-12">
      <Image
        src="/globe.svg"
        alt="Receive File"
        width={64}
        height={64}
        className="mb-6"
      />
      <h2 className="text-2xl font-bold">Receive</h2>
      <p className="mb-6 text-muted-foreground">
        Enter a code to connect and receive.
      </p>

      <div className="flex w-full max-w-sm flex-col space-y-4">
        <Input
          placeholder="Enter code..."
          value={sessionCode}
          onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
          className="text-center text-lg tracking-widest"
        />
        <Button
          size="lg"
          disabled={sessionCode.length < 1}
          onClick={handleConnect}
        >
          Connect
        </Button>
      </div>
    </div>
  );
}
