"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// Define the structure for file metadata
type FileMetadata = {
  name: string;
  type: string;
  size: number;
};

// Define the shape of the data that the hook will expose to the UI
export type ReceivedDataType = {
  type: "text";
  payload: string;
} | {
  type: "file";
  payload: {
    metadata: FileMetadata;
    data: ArrayBuffer;
  };
};

// Define the shape of the hook's return value
interface UseWebRTCReturn {
  isConnected: boolean;
  receivedData: ReceivedDataType | null;
  startConnection: (roomId: string) => void;
  sendText: (text: string) => void;
  sendFile: (file: File) => void;
}

export function useWebRTC(): UseWebRTCReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [receivedData, setReceivedData] = useState<ReceivedDataType | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const incomingFileMetadataRef = useRef<FileMetadata | null>(null);

  useEffect(() => {
    const newSocket = io({ path: "/api/socket" });
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  const sendText = useCallback((text: string) => {
    if (dataChannelRef.current?.readyState === "open") {
      const data = { type: "text", payload: text };
      dataChannelRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendFile = useCallback((file: File) => {
    if (dataChannelRef.current?.readyState === "open") {
      const metadata: FileMetadata = { name: file.name, type: file.type, size: file.size };
      dataChannelRef.current.send(JSON.stringify({ type: "file-meta", payload: metadata }));

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          dataChannelRef.current?.send(event.target.result as ArrayBuffer);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const handleDataChannelEvents = useCallback((channel: RTCDataChannel) => {
    channel.onopen = () => setIsConnected(true);
    channel.onclose = () => setIsConnected(false);
    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data);
        if (msg.type === "text") {
          setReceivedData({ type: "text", payload: msg.payload });
        } else if (msg.type === "file-meta") {
          incomingFileMetadataRef.current = msg.payload;
        }
      } else if (event.data instanceof ArrayBuffer) {
        if (incomingFileMetadataRef.current) {
          setReceivedData({
            type: "file",
            payload: {
              metadata: incomingFileMetadataRef.current,
              data: event.data,
            },
          });
          incomingFileMetadataRef.current = null; // Reset for next file
        }
      }
    };
  }, []);

  const startConnection = useCallback((roomId: string) => {
    if (!socket) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionRef.current = pc;

    pc.onicecandidate = (e) => e.candidate && socket.emit("ice-candidate", { candidate: e.candidate, room: roomId });
    pc.ondatachannel = (e) => {
      dataChannelRef.current = e.channel;
      handleDataChannelEvents(e.channel);
    };

    socket.on("peer-joined", () => {
      const dataChannel = pc.createDataChannel("transfer");
      dataChannelRef.current = dataChannel;
      handleDataChannelEvents(dataChannel);
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => socket.emit("offer", { sdp: pc.localDescription, room: roomId }));
    });

    socket.on("offer", (data) => {
      pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        .then(() => pc.createAnswer())
        .then((answer) => pc.setLocalDescription(answer))
        .then(() => socket.emit("answer", { sdp: pc.localDescription, room: roomId }));
    });

    socket.on("answer", (data) => pc.setRemoteDescription(new RTCSessionDescription(data.sdp)));
    socket.on("ice-candidate", (data) => pc.addIceCandidate(new RTCIceCandidate(data.candidate)));

    socket.emit("join-room", roomId);
  }, [socket, handleDataChannelEvents]);

  return { isConnected, receivedData, startConnection, sendText, sendFile };
}
