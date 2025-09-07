"use client";

import { useState, ChangeEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useWebRTC, HistoryItem } from "@/lib/webrtc";
import { generateSessionCode } from "@/lib/code-generator";
import { cn } from "@/lib/utils";

export function SessionFlow() {
  const [sessionCode, setSessionCode] = useState("");
  const [textToSend, setTextToSend] = useState("");
  const [fileToSend, setFileToSend] = useState<File | null>(null);
  const [mode, setMode] = useState<"initial" | "connecting" | "connected">("initial");

  const { isConnected, history, transferProgress, startConnection, sendText, sendFile } = useWebRTC();

  const handleStart = () => {
    const newCode = generateSessionCode();
    setSessionCode(newCode);
    startConnection(newCode);
    setMode("connecting");
  };

  const handleJoin = () => {
    if (sessionCode) {
      startConnection(sessionCode.toUpperCase());
      setMode("connecting");
    }
  };

  const handleSendText = () => {
    if (textToSend.trim()) {
      sendText(textToSend);
      setTextToSend("");
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFileToSend(event.target.files[0]);
    }
  };

  const handleSendFile = () => {
    if (fileToSend) {
      sendFile(fileToSend);
      setFileToSend(null);
    }
  };

  const handleDownload = (item: HistoryItem) => {
    if (item.type !== "file") return;
    const blob = item.payload.data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.payload.metadata.name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const renderHistoryItem = (item: HistoryItem) => {
    const progress = transferProgress[item.id];
    const isTransferring = progress > 0 && progress < 100;

    return (
      <div
        key={item.id}
        className={cn(
          "flex flex-col w-3/4 max-w-lg p-3 rounded-lg",
          item.direction === "sent" ? "bg-blue-100 self-end text-right" : "bg-gray-100 self-start text-left"
        )}
      >
        {item.type === "text" ? (
          <p className="break-words">{item.payload}</p>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="font-semibold break-all">{item.payload.metadata.name}</p>
            {isTransferring ? (
              <div className="w-full space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">{progress}%</p>
              </div>
            ) : (
              <Button size="sm" onClick={() => handleDownload(item)} className="mt-1">Download</Button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isConnected && mode !== "connecting") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 lg:p-12 w-full">
        <Image src="/globe.svg" alt="Connect" width={64} height={64} className="mb-6" />
        <h2 className="text-2xl font-bold">V-Share</h2>
        <p className="mb-6 text-muted-foreground">Share files and text securely.</p>
        <div className="flex items-center gap-4">
            <Button size="lg" onClick={handleStart}>Generate Code</Button>
            <p>OR</p>
            <div className="flex gap-2">
                <Input
                    placeholder="Enter code..."
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value)}
                    className="text-center"
                />
                <Button disabled={!sessionCode} onClick={handleJoin}>Join</Button>
            </div>
        </div>
      </div>
    );
  }

  if (!isConnected && mode === "connecting") {
    return (
        <div className="flex flex-col items-center space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Waiting for a peer to connect...</p>
            <div className="text-4xl font-bold tracking-widest text-blue-500">{sessionCode}</div>
            <p className="text-xs text-muted-foreground">Have the other device enter this code.</p>
            <Button variant="secondary" onClick={() => setMode("initial")}>Cancel</Button>
        </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-[75vh] max-w-4xl mx-auto border rounded-lg">
      <div className="flex-1 flex flex-col-reverse p-4 gap-4 overflow-y-auto">
        {history.length > 0 ? history.map(renderHistoryItem) : <p className="text-center text-muted-foreground">History will appear here.</p>}
      </div>
      <div className="p-4 border-t bg-gray-50">
        <div className="flex items-center gap-2">
            <Input type="text" placeholder="Type a message..." value={textToSend} onChange={(e) => setTextToSend(e.target.value)} />
            <Button onClick={handleSendText}>Send Text</Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
            <Input type="file" onChange={handleFileChange} />
            <Button onClick={handleSendFile} disabled={!fileToSend}>Send File</Button>
        </div>
      </div>
    </div>
  );
}
