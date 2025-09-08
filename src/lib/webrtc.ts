"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const CHUNK_SIZE = 64 * 1024; // 64 KB

type FileMetadata = {
  name: string;
  type: string;
  size: number;
};

// This type now represents any item in the history, sent or received.
export type HistoryItem = {
  id: string;
  direction: "sent" | "received";
  type: "text";
  payload: string;
} | {
  id: string;
  direction: "sent" | "received";
  type: "file";
  payload: {
    metadata: FileMetadata;
    data: Blob;
  };
};

interface UseWebRTCReturn {
  isConnected: boolean;
  history: HistoryItem[];
  transferProgress: { [id: string]: number }; // Progress per item
  startConnection: (roomId: string) => void;
  sendText: (text: string) => void;
  sendFile: (file: File) => void;
}

export function useWebRTC(): UseWebRTCReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [transferProgress, setTransferProgress] = useState<{ [id: string]: number }>({});

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const roomIdRef = useRef<string | null>(null);

  const fileToSendRef = useRef<{ file: File; id: string } | null>(null);
  const sendOffsetRef = useRef<number>(0);
  
  const incomingFileRef = useRef<{ id: string; metadata: FileMetadata; data: ArrayBuffer[] } | null>(null);
  const receivedSizeRef = useRef<number>(0);

  const updateProgress = (id: string, progress: number) => {
    setTransferProgress(prev => ({ ...prev, [id]: progress }));
  };

  const sendNextChunk = useCallback(() => {
    if (!fileToSendRef.current || !dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;
    const { file, id } = fileToSendRef.current;
    const offset = sendOffsetRef.current;

    if (offset >= file.size) {
      setTimeout(() => updateProgress(id, 0), 2000);
      fileToSendRef.current = null;
      return;
    }

    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && dataChannelRef.current) {
        dataChannelRef.current.send(event.target.result as ArrayBuffer);
        sendOffsetRef.current += chunk.size;
        const progress = Math.round((sendOffsetRef.current / file.size) * 100);
        updateProgress(id, progress);
      }
    };
    reader.readAsArrayBuffer(chunk);
  }, []);

  const handleDataChannelEvents = useCallback((channel: RTCDataChannel) => {
    channel.onopen = () => setIsConnected(true);
    channel.onclose = () => { setIsConnected(false); setTransferProgress({}); };
    
    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "text":
            setHistory(prev => [{ id: msg.id, direction: "received", type: "text", payload: msg.payload }, ...prev]);
            break;
          case "file-meta":
            incomingFileRef.current = { id: msg.id, metadata: msg.payload, data: [] };
            receivedSizeRef.current = 0;
            updateProgress(msg.id, 0);
            channel.send(JSON.stringify({ type: "file-ack", id: msg.id }));
            break;
          case "file-ack":
            if (fileToSendRef.current && fileToSendRef.current.id === msg.id) {
              sendNextChunk();
            }
            break;
        }
      } else if (event.data instanceof ArrayBuffer) {
        if (incomingFileRef.current) {
          const { id, metadata, data } = incomingFileRef.current;
          data.push(event.data);
          receivedSizeRef.current += event.data.byteLength;
          channel.send(JSON.stringify({ type: "file-ack", id }));

          const progress = Math.round((receivedSizeRef.current / metadata.size) * 100);
          updateProgress(id, progress);

          if (receivedSizeRef.current >= metadata.size) {
            const fileBlob = new Blob(data, { type: metadata.type });
            const newFile: HistoryItem = { id, direction: "received", type: "file", payload: { metadata, data: fileBlob } };
            setHistory(prev => [newFile, ...prev]);
            
            incomingFileRef.current = null;
            receivedSizeRef.current = 0;
            setTimeout(() => updateProgress(id, 0), 2000);
          }
        }
      }
    };
  }, [sendNextChunk]);

  useEffect(() => {
    const newSocket = io({ path: "/api/socket" });
    setSocket(newSocket);

    newSocket.on("peer-joined", () => {
      if (!peerConnectionRef.current || !roomIdRef.current) return;
      const dataChannel = peerConnectionRef.current.createDataChannel("transfer");
      dataChannelRef.current = dataChannel;
      handleDataChannelEvents(dataChannel);
      peerConnectionRef.current.createOffer()
        .then((offer) => peerConnectionRef.current?.setLocalDescription(offer))
        .then(() => newSocket.emit("offer", { sdp: peerConnectionRef.current?.localDescription, room: roomIdRef.current }));
    });

    newSocket.on("offer", (data) => {
      if (!peerConnectionRef.current || !roomIdRef.current) return;
      peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp))
        .then(() => peerConnectionRef.current?.createAnswer())
        .then((answer) => peerConnectionRef.current?.setLocalDescription(answer))
        .then(() => newSocket.emit("answer", { sdp: peerConnectionRef.current?.localDescription, room: roomIdRef.current }));
    });

    newSocket.on("answer", (data) => { if (!peerConnectionRef.current) return; peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp)); });
    newSocket.on("ice-candidate", (data) => { if (!peerConnectionRef.current) return; peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); });

    return () => { newSocket.disconnect(); };
  }, [handleDataChannelEvents]);

  const startConnection = useCallback((roomId: string) => {
    if (!socket) return;
    roomIdRef.current = roomId;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerConnectionRef.current = pc;
    pc.onicecandidate = (e) => e.candidate && socket.emit("ice-candidate", { candidate: e.candidate, room: roomId });
    pc.ondatachannel = (e) => { dataChannelRef.current = e.channel; handleDataChannelEvents(e.channel); };
    socket.emit("join-room", roomId);
  }, [socket, handleDataChannelEvents]);

  const sendText = useCallback((text: string) => {
    if (dataChannelRef.current?.readyState !== "open") return;
    const id = Date.now().toString();
    const newTextItem: HistoryItem = { id, direction: "sent", type: "text", payload: text };
    setHistory(prev => [newTextItem, ...prev]);
    dataChannelRef.current.send(JSON.stringify({ type: "text", payload: text, id }));
  }, []);

  const sendFile = useCallback((file: File) => {
    if (dataChannelRef.current?.readyState !== 'open') return;
    const id = Date.now().toString();
    fileToSendRef.current = { file, id };
    sendOffsetRef.current = 0;
    updateProgress(id, 0);

    const metadata: FileMetadata = { name: file.name, type: file.type, size: file.size };
    dataChannelRef.current.send(JSON.stringify({ type: "file-meta", payload: metadata, id }));
  }, []);

  return { isConnected, history, transferProgress, startConnection, sendText, sendFile };
}
