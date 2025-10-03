"use client";

import { useState, ChangeEvent, useRef, useEffect } from "react";
import Image from "next/image";
import { Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useWebRTC, HistoryItem, WebRTCHook } from "@/lib/webrtc";
import { generateSessionCode } from "@/lib/code-generator";
import { cn } from "@/lib/utils";

export function SessionFlow() {
  const [sessionCode, setSessionCode] = useState("");
  const [textToSend, setTextToSend] = useState("");
  const [mode, setMode] = useState<"initial" | "connecting" | "connected">("initial");
  const [connectionStatus, setConnectionStatus] = useState("Waiting for peer to connect...");
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { isConnected, history, startConnection, sendText, sendFile, endConnection }: WebRTCHook = useWebRTC();

  useEffect(() => {
    if (isConnected) {
      setMode("connected");
    } else {
      setMode("initial");
    }
  }, [isConnected]);

  useEffect(() => {
    // Scroll to the bottom of the chat window when a new message is added
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    if (fileQueue.length > 0 && !isProcessingQueue) {
      processQueue();
    }
  }, [fileQueue, isProcessingQueue]);

  const processQueue = () => {
    if (fileQueue.length === 0) {
      setIsProcessingQueue(false);
      return;
    }

    setIsProcessingQueue(true);
    const file = fileQueue[0];
    sendFile(file, () => {
      setFileQueue(prev => prev.slice(1));
      setIsProcessingQueue(false);
    });
  };


  const handleStart = () => {
    const newCode = generateSessionCode().toLowerCase();
    setSessionCode(newCode);
    startConnection(newCode, true, setConnectionStatus); // isCreator = true
    setMode("connecting");
  };

  const handleJoin = () => {
    if (sessionCode) {
      startConnection(sessionCode.toLowerCase(), false, setConnectionStatus); // isCreator = false
      setMode("connecting");
    }
  };

  const handleCancel = () => {
    endConnection();
    setMode("initial");
    setSessionCode("");
  }

  const handleSendText = () => {
    if (textToSend.trim()) {
      sendText(textToSend);
      setTextToSend("");
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      setFileQueue(prev => [...prev, ...files]);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleDownload = (item: HistoryItem) => {
    if (item.type !== "file" || !item.payload.data) return;
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

  const handleEndSession = () => {
    endConnection();
  };

  const renderHistoryItem = (item: HistoryItem) => {
    const progress = item.progress;
    const isTransferring = typeof progress === 'number' && progress >= 0 && progress < 100;
    const isSent = item.direction === "sent";
    const isReceived = item.direction === "received";

    return (
      <div
        key={item.id}
        className={cn(
          "flex flex-col w-fit max-w-xs md:max-w-md p-3 rounded-xl shadow-md",
          isSent
            ? "bg-blue-600 text-white self-end rounded-br-none"
            : "bg-white text-slate-800 self-start rounded-bl-none"
        )}
      >
        {item.type === "text" ? (
          <p className="break-words">{item.payload}</p>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="font-semibold break-all">{item.payload.metadata.name}</p>
            {isTransferring ? (
              <div className="w-full space-y-1">
                <Progress value={progress} className={cn("h-2", isSent ? "[&>*]:bg-white" : "[&>*]:bg-blue-600")} />
                <p className="text-xs font-mono">
                  {isSent ? "Sending" : "Receiving"}... {progress}%
                </p>
              </div>
            ) : (
              isReceived && (
                <Button
                  size="sm"
                  onClick={() => handleDownload(item)}
                  className="mt-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 border border-blue-700 shadow"
                >
                  Download
                </Button>
              )
            )}
          </div>
        )}
      </div>
    );
  };

  if (mode === "initial") {
    return (
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-4 sm:p-8 space-y-6">
        <div className="text-center">
          <Image src="/file.svg" alt="V-Share Logo" width={64} height={64} className="mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">V-Share</h1>
          <p className="text-slate-500 mt-2">Instant, secure peer-to-peer file sharing.</p>
        </div>
        
        <div className="space-y-4">
          <span className="flex justify-center items-center">
            <Button className="w-full sm:w-1/2 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleStart}>Generate Code</Button>
          </span>
          
          <div className="flex items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-sm">OR</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter connection code..."
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value)}
              className="text-center text-lg tracking-wider font-mono"
            />
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!sessionCode} onClick={handleJoin}>Join</Button>
          </div>
          <p className="text-xs text-center text-slate-500 pt-2">It may take 15-30 seconds for the devices to connect.</p>
        </div>
      </div>
    );
  }

  if (mode === "connecting") {
    return (
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-4 sm:p-8 flex flex-col items-center justify-center text-center space-y-6">
        <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
        <div>
          <p className="text-slate-500">{connectionStatus}</p>
          <div className="text-3xl sm:text-4xl font-mono tracking-widest text-slate-800 my-4 p-4 bg-slate-100 rounded-lg">
            {sessionCode}
          </div>
          <p className="text-xs text-slate-400">Share this code with the other device.</p>
        </div>
        <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-screen md:h-[90vh] md:max-w-2xl bg-white md:rounded-2xl shadow-xl overflow-hidden">
      <header className="p-4 border-b bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Connected</h2>
          <div className="flex items-center gap-2">
            <div className="text-sm font-mono text-slate-500 bg-slate-200 px-3 py-1 rounded-full">
              {sessionCode}
            </div>
            <Button size="sm" onClick={handleEndSession} variant="ghost" className="text-red-600 hover:bg-red-100 border border-red-200 font-semibold rounded-full px-4 py-1 transition">
              End Session
            </Button>
          </div>
        </div>
      </header>
      
      <div ref={messagesContainerRef} className="flex-1 flex flex-col justify-end p-4 md:p-6 gap-4 overflow-y-auto bg-slate-100">
        {history.length > 0 ? history.map(renderHistoryItem) : (
          <div className="text-center self-center">
            <Image src="/window.svg" alt="Empty History" width={96} height={96} className="mx-auto opacity-40" />
            <p className="mt-4 text-slate-500">History will appear here.</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-white">
        <div className="flex items-center gap-3">
          <Input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
          />
          <Button variant="ghost" size="icon" onClick={handleAttachmentClick} title="Send file" className="flex-shrink-0 h-10 w-10 rounded-full hover:bg-slate-100 text-slate-500">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            type="text"
            placeholder="Type a message..."
            value={textToSend}
            onChange={(e) => setTextToSend(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendText();
              }
            }}
            className="flex-grow h-10 rounded-full bg-slate-100 px-4 focus-visible:ring-1 focus-visible:ring-blue-600 border-transparent"
          />
          <Button onClick={handleSendText} disabled={!textToSend.trim()} className="flex-shrink-0 h-10 w-10 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
