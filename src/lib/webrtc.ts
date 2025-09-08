"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Ably from "ably";

const CHUNK_SIZE = 64 * 1024; // 64 KB

type FileMetadata = {
  name: string;
  type: string;
  size: number;
};

export type HistoryItem = {
  id: string;
  direction: "sent" | "received";
  type: "text";
  payload: string;
  progress?: number;
} | {
  id: string;
  direction: "sent" | "received";
  type: "file";
  payload: {
    metadata: FileMetadata;
    data: Blob;
  };
  progress?: number;
};

interface UseWebRTCReturn {
  isConnected: boolean;
  history: HistoryItem[];
  startConnection: (roomId: string) => void;
  sendText: (text: string) => void;
  sendFile: (file: File) => void;
}

export function useWebRTC(): UseWebRTCReturn {
  const [ably, setAbly] = useState<Ably.Realtime | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const channelRef = useRef<Ably.Types.RealtimeChannelPromise | null>(null);

  const fileToSendRef = useRef<{ file: File; id: string } | null>(null);
  const sendOffsetRef = useRef<number>(0);
  
  const incomingFileRef = useRef<{ id: string; metadata: FileMetadata; data: ArrayBuffer[] } | null>(null);
  const receivedSizeRef = useRef<number>(0);

  useEffect(() => {
    const ablyClient = new Ably.Realtime({ authUrl: '/api/ably-auth' });
    setAbly(ablyClient);

    return () => {
      ablyClient.close();
    };
  }, []);

  const updateProgress = useCallback((id: string, progress: number) => {
    setHistory(prev => 
      prev.map(item => 
        item.id === id ? { ...item, progress } : item
      )
    );
  }, []);

  const sendNextChunk = useCallback(() => {
    if (!fileToSendRef.current || !dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;
    const { file, id } = fileToSendRef.current;
    const offset = sendOffsetRef.current;

    if (offset >= file.size) {
      setTimeout(() => updateProgress(id, 100), 500);
      setTimeout(() => updateProgress(id, -1), 2000);
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
  }, [updateProgress]);

  const handleDataChannelEvents = useCallback((channel: RTCDataChannel) => {
    channel.onopen = () => setIsConnected(true);
    channel.onclose = () => { setIsConnected(false); };
    
    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "text":
            setHistory(prev => [{ id: msg.id, direction: "received", type: "text", payload: msg.payload }, ...prev]);
            break;
          case "file-meta":
            const newFileItem: HistoryItem = {
              id: msg.id,
              direction: "received",
              type: "file",
              payload: { metadata: msg.payload, data: new Blob() },
              progress: 0,
            };
            setHistory(prev => [newFileItem, ...prev]);
            incomingFileRef.current = { id: msg.id, metadata: msg.payload, data: [] };
            receivedSizeRef.current = 0;
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
          
          const progress = Math.round((receivedSizeRef.current / metadata.size) * 100);
          updateProgress(id, progress);

          channel.send(JSON.stringify({ type: "file-ack", id }));

          if (receivedSizeRef.current >= metadata.size) {
            const fileBlob = new Blob(data, { type: metadata.type });
            setHistory(prev => 
              prev.map(item => 
                item.id === id ? { ...item, payload: { ...item.payload, data: fileBlob }, progress: -1 } : item
              )
            );
            incomingFileRef.current = null;
            receivedSizeRef.current = 0;
          }
        }
      }
    };
  }, [sendNextChunk, updateProgress]);

  const startConnection = useCallback(async (roomId: string) => {
    if (!ably) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerConnectionRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        channelRef.current?.publish({ name: "ice-candidate", data: { candidate: e.candidate } });
      }
    };

    pc.ondatachannel = (e) => {
      dataChannelRef.current = e.channel;
      handleDataChannelEvents(e.channel);
    };

    const channel = ably.channels.get(`vshare-${roomId.toUpperCase()}`);
    channelRef.current = channel;

    await channel.subscribe(async (message) => {
      if (ably && message.clientId === ably.auth.clientId) return;
      
      const { name, data } = message;
      if (name === "ice-candidate") {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else if (name === "offer") {
        if (pc.signalingState !== 'stable') return;
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.publish({ name: "answer", data: { sdp: pc.localDescription } });
      } else if (name === "answer") {
        if (pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (name === "peer-joined") {
        if (pc.signalingState !== 'stable') return;
        const dataChannel = pc.createDataChannel("transfer");
        dataChannelRef.current = dataChannel;
        handleDataChannelEvents(dataChannel);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.publish({ name: "offer", data: { sdp: pc.localDescription } });
      }
    });

    channel.publish({ name: "peer-joined", data: {} });

  }, [ably, handleDataChannelEvents]);

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
    const metadata: FileMetadata = { name: file.name, type: file.type, size: file.size };

    const newFileItem: HistoryItem = {
      id,
      direction: 'sent',
      type: 'file',
      payload: {
        metadata,
        data: file,
      },
      progress: 0,
    };
    setHistory(prev => [newFileItem, ...prev]);

    fileToSendRef.current = { file, id };
    sendOffsetRef.current = 0;

    dataChannelRef.current.send(JSON.stringify({ type: 'file-meta', payload: metadata, id }));
  }, []);

  return { isConnected, history, startConnection, sendText, sendFile };
}