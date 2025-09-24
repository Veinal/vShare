"use client";

import { useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SIGNALING_SERVER_URL = 'https://vshare-o6b1.onrender.com';

const ICE_SERVERS = [
  // STUN servers (these are correct)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stunserver.stunprotocol.org:3478' },
  // Correct TURN server credentials
  { 
    urls: 'turn:openrelay.metered.ca:80', 
    username: 'openrelayproject', 
    credential: 'openrelayproject' 
  },{ 
    urls: 'turn:openrelay.metered.ca:443', 
    username: 'openrelayproject', 
    credential: 'openrelayproject' 
  },{ 
    urls: 'turn:openrelay.metered.ca:443?transport=tcp', 
    username: 'openrelayproject', 
    credential: 'openrelayproject' 
  }
];


export interface HistoryItem {
  id: number;
  type: 'text' | 'file';
  direction: 'sent' | 'received';
  payload: any;
  progress?: number;
}

export interface FileMetadata {
    name: string;
    type: string;
    size: number;
}

// Define a new interface for the hook's return value for clarity
export interface WebRTCHook {
    isConnected: boolean;
    history: HistoryItem[];
    status: string;
    startConnection: (sessionCode: string, isCreator: boolean, onStatusUpdate: (status: string) => void) => void;
    sendText: (text: string) => void;
    sendFile: (file: File) => void;
    endConnection: () => void;
}

export function useWebRTC(): WebRTCHook {
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState('');
  
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  
  // Refs for file transfer state
  const fileSendProgressRef = useRef<{[fileName: string]: number}>({});
  const receivingFileRef = useRef<{ metadata: FileMetadata, buffer: ArrayBuffer[] } | null>(null);

  const updateFileProgress = useCallback((fileName: string, progress: number | undefined) => {
    setHistory(prev => prev.map(item => 
        item.type === 'file' && item.payload.metadata.name === fileName 
        ? { ...item, progress } 
        : item
    ));
  }, []);

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
        const message = JSON.parse(event.data);
        if (message.type === 'file-start') {
            receivingFileRef.current = { metadata: message.metadata, buffer: [] };
            setHistory(prev => [...prev, { id: Date.now(), type: 'file', direction: 'received', payload: { metadata: message.metadata, data: new Blob() }, progress: 0 }]);
        } else if (message.type === 'file-end') {
            if (!receivingFileRef.current) return;
            const file = new Blob(receivingFileRef.current.buffer, { type: receivingFileRef.current.metadata.type });
            const metadata = receivingFileRef.current.metadata;
            setHistory(prev => prev.map(item => 
                item.type === 'file' && item.payload.metadata.name === metadata.name 
                ? { ...item, payload: { ...item.payload, data: file }, progress: undefined } 
                : item
            ));
            receivingFileRef.current = null;
        } else if (message.type === 'text') {
            setHistory(prev => [...prev, { id: Date.now(), type: 'text', direction: 'received', payload: message.payload }]);
        }
    } catch (error) { // This part handles binary file chunks
        if (receivingFileRef.current) {
            receivingFileRef.current.buffer.push(event.data);
            const receivedSize = receivingFileRef.current.buffer.reduce((acc, chunk) => acc + chunk.byteLength, 0);
            const progress = Math.round((receivedSize / receivingFileRef.current.metadata.size) * 100);
            updateFileProgress(receivingFileRef.current.metadata.name, progress);
        }
    }
  }, [updateFileProgress]);

  const endConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
    setHistory([]);
    setStatus('');
    console.log("Connection ended and cleaned up.");
  }, []);

  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dc.onopen = () => {
      setStatus('Data channel open');
      setIsConnected(true);
    };
    dc.onclose = () => {
      setStatus('Data channel closed');
      // Use endConnection to clean up everything
      endConnection();
    };
    dc.onmessage = handleDataChannelMessage;
    dcRef.current = dc;
  }, [handleDataChannelMessage, endConnection]);

  const startConnection = useCallback((sessionCode: string, isCreator: boolean, onStatusUpdate: (status: string) => void) => {
    // Prevent multiple connections
    if (socketRef.current) return;

    const updateStatus = (newStatus: string) => {
      setStatus(newStatus);
      onStatusUpdate(newStatus);
    };

    updateStatus('Connecting to signaling server...');
    const socket = io(SIGNALING_SERVER_URL);
    socketRef.current = socket;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', { candidate: event.candidate, sessionCode });
      }
    };

    pc.onconnectionstatechange = () => {
        updateStatus(`Connection state: ${pc.connectionState}`);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            endConnection();
        }
    };

    if (isCreator) {
      const dc = pc.createDataChannel('data');
      setupDataChannel(dc);
      
      socket.emit('create-and-join', sessionCode);
      socket.on('session-created', async () => {
          updateStatus('Session created on server.');
      });
      socket.on('peer-joined', async () => {
        updateStatus('Peer joined, creating offer...');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { sdp: offer, sessionCode });
      });
    } else { // Is Joiner
      pc.ondatachannel = (event) => {
        updateStatus('Received data channel');
        setupDataChannel(event.channel);
      };
      socket.emit('join-session', sessionCode);
    }

    socket.on('webrtc-offer', async (sdp) => {
      updateStatus('Received offer, creating answer...');
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { sdp: answer, sessionCode });
    });

    socket.on('webrtc-answer', async (sdp) => {
      updateStatus('Received answer.');
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on('webrtc-ice-candidate', (candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('session-error', (message) => {
        alert(`Session error: ${message}`);
        endConnection();
    });

  }, [setupDataChannel, endConnection]);

  const sendText = (text: string) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify({ type: 'text', payload: text }));
      setHistory(prev => [...prev, { id: Date.now(), type: 'text', direction: 'sent', payload: text }]);
    }
  };

  const sendFile = (file: File) => {
    const dataChannel = dcRef.current;
    if (dataChannel && dataChannel.readyState === 'open') {
        const CHUNK_SIZE = 64 * 1024; // 64KB
        const metadata = { name: file.name, type: file.type, size: file.size };
        
        dataChannel.send(JSON.stringify({ type: 'file-start', metadata }));
        setHistory(prev => [...prev, { id: Date.now(), type: 'file', direction: 'sent', payload: { metadata, data: new Blob() }, progress: 0 }]);

        let offset = 0;
        const reader = new FileReader();

        reader.onload = (e) => {
            if (!e.target?.result || !dataChannel || dataChannel.readyState !== 'open') return;
            
            const chunk = e.target.result as ArrayBuffer;
            // Backpressure handling
            if (dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold) {
                setTimeout(() => { if(reader.onload) reader.onload(e); }, 100);
                return;
            }

            dataChannel.send(chunk);
            offset += chunk.byteLength;
            
            const progress = Math.round((offset / file.size) * 100);
            updateFileProgress(file.name, progress);

            if (offset < file.size) {
                readSlice(offset);
            } else {
                dataChannel.send(JSON.stringify({ type: 'file-end' }));
                // Final progress update to show completion before download
                updateFileProgress(file.name, undefined);
            }
        };

        const readSlice = (o: number) => {
            const slice = file.slice(o, o + CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };
        readSlice(0);
    }
  };

  return { isConnected, history, status, startConnection, sendText, sendFile, endConnection };
}
