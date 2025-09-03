"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWebRTC, ReceivedDataType } from "@/lib/webrtc";

export function ReceiverFlow() {
  const [sessionCode, setSessionCode] = useState("");
  const { isConnected, receivedData, startConnection } = useWebRTC();

  const handleConnect = () => {
    if (sessionCode) {
      startConnection(sessionCode);
    }
  };

  const handleDownload = (fileData: ReceivedDataType) => {
    if (fileData.type !== "file") return;

    const blob = new Blob([fileData.payload.data], { type: fileData.payload.metadata.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileData.payload.metadata.name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const renderReceivedData = () => {
    if (!receivedData) return null;

    if (receivedData.type === "text") {
      return (
        <div className="w-full rounded-md bg-muted p-4">
          <p className="text-sm font-semibold">Received Text:</p>
          <p className="break-words font-mono">{receivedData.payload}</p>
        </div>
      );
    }

    if (receivedData.type === "file") {
      return (
        <div className="w-full rounded-md bg-muted p-4 text-center">
          <p className="text-sm font-semibold">Received File:</p>
          <p className="break-words font-mono">{receivedData.payload.metadata.name}</p>
          <Button onClick={() => handleDownload(receivedData)} className="mt-2">
            Download
          </Button>
        </div>
      );
    }

    return null;
  };

  const renderContent = () => {
    if (isConnected) {
      return (
        <div className="flex w-full flex-col items-center space-y-4 text-center">
          <p className="font-medium text-green-600">✅ Connected!</p>
          <p className="text-sm text-muted-foreground">Waiting to receive data...</p>
          {renderReceivedData()}
        </div>
      );
    }

    return (
      <div className="flex w-full max-w-sm flex-col space-y-4">
        <Input
          placeholder="Enter code..."
          value={sessionCode}
          onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
          className="text-center text-lg tracking-widest"
        />
        <Button size="lg" disabled={sessionCode.length < 1} onClick={handleConnect}>
          Connect
        </Button>
      </div>
    );
  };

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 lg:p-12">
      <Image src="/globe.svg" alt="Receive File" width={64} height={64} className="mb-6" />
      <h2 className="text-2xl font-bold">Receive</h2>
      <p className="mb-6 text-muted-foreground">Enter a code to connect and receive.</p>
      {renderContent()}
    </div>
  );
}
