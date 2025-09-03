"use client";

import { useState, ChangeEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateSessionCode } from "@/lib/code-generator";
import { useWebRTC } from "@/lib/webrtc";

export function SenderFlow() {
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [textToSend, setTextToSend] = useState("");
  const [fileToSend, setFileToSend] = useState<File | null>(null);
  const { isConnected, startConnection, sendText, sendFile } = useWebRTC();

  const handleStartSharing = () => {
    const newCode = generateSessionCode();
    setSessionCode(newCode);
    startConnection(newCode);
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
      setFileToSend(null); // Clear the file input after sending
    }
  };

  const handleCancel = () => {
    setSessionCode(null);
    // Proper disconnection logic should be added here later
  };

  const renderContent = () => {
    if (!sessionCode) {
      return <Button onClick={handleStartSharing} size="lg">Generate Code</Button>;
    }

    if (isConnected) {
      return (
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="font-medium text-green-600">✅ Connected!</p>
          <div className="space-y-2">
            <Input
              placeholder="Type a message..."
              value={textToSend}
              onChange={(e) => setTextToSend(e.target.value)}
            />
            <Button onClick={handleSendText} className="w-full">Send Text</Button>
          </div>
          <div className="space-y-2">
            <Input type="file" onChange={handleFileChange} />
            <Button onClick={handleSendFile} disabled={!fileToSend} className="w-full">
              Send File
            </Button>
          </div>
          <Button variant="secondary" onClick={handleCancel} className="w-full">End Session</Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center space-y-4 text-center">
        <p className="text-sm text-muted-foreground">Waiting for a peer to connect...</p>
        <div className="text-4xl font-bold tracking-widest text-blue-500">{sessionCode}</div>
        <p className="text-xs text-muted-foreground">Have the other device enter this code.</p>
        <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
      </div>
    );
  };

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 lg:p-12">
      <Image src="/file.svg" alt="Send File" width={64} height={64} className="mb-6" />
      <h2 className="text-2xl font-bold">Send</h2>
      <p className="mb-6 text-muted-foreground">Generate a code to share files.</p>
      {renderContent()}
    </div>
  );
}
