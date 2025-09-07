"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// --- Constants ---
const CHUNK_SIZE = 64 * 1024; // 64 KB

// --- Type Definitions ---
type FileMetadata = {
  name: string;
  type: string;
  size: number;
};

export type ReceivedDataType = {
  type: "text";
  payload: string;
} | {
  type: "file";
  payload: {
    metadata: FileMetadata;
    data: Blob; // Use Blob for the complete file
  };
};

interface UseWebRTCReturn {
  isConnected: boolean;
  receivedData: ReceivedDataType | null;
  transferProgress: number; // To show progress percentage
  startConnection: (roomId: string) => void;
  sendText: (text: string) => void;
  sendFile: (file: File) => void;
}

// --- Main Hook ---
export function useWebRTC(): UseWebRTCReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [receivedData, setReceivedData] = useState<ReceivedDataType | null>(null);
  const [transferProgress, setTransferProgress] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const roomIdRef = useRef<string | null>(null);

  // Refs for file transfer state
  const fileToSendRef = useRef<File | null>(null);
  const sendOffsetRef = useRef<number>(0);
  
  const incomingFileMetadataRef = useRef<FileMetadata | null>(null);
  const incomingFileDataRef = useRef<ArrayBuffer[]>([]);
  const receivedSizeRef = useRef<number>(0);


  // --- Socket & Peer Connection Setup ---
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

    newSocket.on("answer", (data) => {
      if (!peerConnectionRef.current) return;
      peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
    });

    newSocket.on("ice-candidate", (data) => {
      if (!peerConnectionRef.current) return;
      peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    });

    return () => { newSocket.disconnect(); };
  }, []);

  // --- Data Sending Logic ---
  const sendText = useCallback((text: string) => {
    if (dataChannelRef.current?.readyState === "open") {
      const data = { type: "text", payload: text };
      dataChannelRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendFile = useCallback((file: File) => {
    if (dataChannelRef.current?.readyState !== 'open') return;
    
    fileToSendRef.current = file;
    sendOffsetRef.current = 0;
    setTransferProgress(0);

    const metadata: FileMetadata = { name: file.name, type: file.type, size: file.size };
    dataChannelRef.current.send(JSON.stringify({ type: "file-meta", payload: metadata }));
  }, []);

  const sendNextChunk = useCallback(() => {
    if (!fileToSendRef.current || !dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

    const file = fileToSendRef.current;
    const offset = sendOffsetRef.current;

    if (offset >= file.size) {
      // All chunks sent
      fileToSendRef.current = null;
      return;
    }

    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target?.result && dataChannelRef.current) {
        dataChannelRef.current.send(event.target.result as ArrayBuffer);
        sendOffsetRef.current += chunk.size;
        setTransferProgress(Math.round((sendOffsetRef.current / file.size) * 100));
      }
    };
    reader.readAsArrayBuffer(chunk);
  }, []);

  // --- Data Channel Event Handling ---
  const handleDataChannelEvents = useCallback((channel: RTCDataChannel) => {
    channel.onopen = () => setIsConnected(true);
    channel.onclose = () => {
      setIsConnected(false);
      // Reset state on close
      setTransferProgress(0);
      incomingFileMetadataRef.current = null;
      incomingFileDataRef.current = [];
      receivedSizeRef.current = 0;
    };
    
    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "text":
            setReceivedData({ type: "text", payload: msg.payload });
            break;
          case "file-meta":
            incomingFileMetadataRef.current = msg.payload;
            incomingFileDataRef.current = [];
            receivedSizeRef.current = 0;
            setTransferProgress(0);
            // Acknowledge metadata and ask for the first chunk
            channel.send(JSON.stringify({ type: "file-ack" }));
            break;
          case "file-ack":
            // Receiver is ready for the next chunk
            sendNextChunk();
            break;
        }
      } else if (event.data instanceof ArrayBuffer) {
        if (incomingFileMetadataRef.current) {
          incomingFileDataRef.current.push(event.data);
          receivedSizeRef.current += event.data.byteLength;

          const progress = Math.round((receivedSizeRef.current / incomingFileMetadataRef.current.size) * 100);
          setTransferProgress(progress);

          if (receivedSizeRef.current >= incomingFileMetadataRef.current.size) {
            // File transfer complete
            const fileBlob = new Blob(incomingFileDataRef.current, { type: incomingFileMetadataRef.current.type });
            setReceivedData({
              type: "file",
              payload: {
                metadata: incomingFileMetadataRef.current,
                data: fileBlob,
              },
            });
            // Reset for next file
            incomingFileMetadataRef.current = null;
            incomingFileDataRef.current = [];
            receivedSizeRef.current = 0;
          } else {
            // Acknowledge chunk and ask for the next one
            channel.send(JSON.stringify({ type: "file-ack" }));
          }
        }
      }
    };
  }, [sendNextChunk]);

  // --- Connection Initialization ---
  const startConnection = useCallback((roomId: string) => {
    if (!socket) return;
    roomIdRef.current = roomId;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionRef.current = pc;

    pc.onicecandidate = (e) => e.candidate && socket.emit("ice-candidate", { candidate: e.candidate, room: roomId });
    pc.ondatachannel = (e) => {
      dataChannelRef.current = e.channel;
      handleDataChannelEvents(e.channel);
    };

    socket.emit("join-room", roomId);
  }, [socket, handleDataChannelEvents]);

  return { isConnected, receivedData, transferProgress, startConnection, sendText, sendFile };
}