"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { generateSessionCode } from "@/lib/code-generator";
import { useWebRTC } from "@/lib/webrtc";

export function SenderFlow() {
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const { startConnection } = useWebRTC();

  const handleStartSharing = () => {
    const newCode = generateSessionCode();
    setSessionCode(newCode);
    startConnection(newCode);
  };

  const handleCopyToClipboard = () => {
    if (!sessionCode) return;
    navigator.clipboard.writeText(sessionCode);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000); // Reset after 2 seconds
  };

  const handleCancel = () => {
    setSessionCode(null);
  };

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 lg:p-12">
      <Image
        src="/file.svg"
        alt="Send File"
        width={64}
        height={64}
        className="mb-6"
      />
      <h2 className="text-2xl font-bold">Send</h2>
      <p className="mb-6 text-muted-foreground">
        Generate a code to share files.
      </p>

      {sessionCode ? (
        <div className="flex flex-col items-center space-y-4">
          <p className="text-sm text-muted-foreground">Your session code is:</p>
          <div className="text-4xl font-bold tracking-widest text-blue-500">
            {sessionCode}
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleCopyToClipboard}>
              {hasCopied ? "Copied!" : "Copy Code"}
            </Button>
            <Button variant="secondary" onClick={handleCancel}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={handleStartSharing} size="lg">
          Generate Code
        </Button>
      )}
    </div>
  );
}
