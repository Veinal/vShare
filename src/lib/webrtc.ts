"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// Define the shape of the hook's return value for type safety
interface UseWebRTCReturn {
  startConnection: (roomId: string) => void;
  // We will add more functions and state here later (e.g., sendFile, receivedData)
}

// A custom hook to encapsulate WebRTC logic
export function useWebRTC(): UseWebRTCReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Effect to initialize and clean up the socket connection
  useEffect(() => {
    // The path option is important to match our server setup
    const newSocket = io({ path: "/api/socket" });
    setSocket(newSocket);

    // Cleanup function to disconnect the socket when the component unmounts
    return () => {
      newSocket.disconnect();
    };
  }, []); // The empty dependency array means this runs only once

  const startConnection = (roomId: string) => {
    if (!socket) {
      console.error("Socket not initialized");
      return;
    }

    console.log(`Starting WebRTC connection for room: ${roomId}`);

    // 1. Create a new RTCPeerConnection
    // We'll use public STUN servers from Google to help NAT traversal
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    peerConnectionRef.current = pc;

    // 2. Set up listeners for signaling events from the socket server
    socket.on("peer-joined", () => {
      console.log("A peer has joined the room. Creating offer...");
      // The first user (sender) will create an offer
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (pc.localDescription) {
            socket.emit("offer", { sdp: pc.localDescription, room: roomId });
          }
        });
    });

    socket.on("offer", (data: { sdp: RTCSessionDescriptionInit }) => {
      console.log("Received offer. Creating answer...");
      pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        .then(() => pc.createAnswer())
        .then((answer) => pc.setLocalDescription(answer))
        .then(() => {
          if (pc.localDescription) {
            socket.emit("answer", { sdp: pc.localDescription, room: roomId });
          }
        });
    });

    socket.on("answer", (data: { sdp: RTCSessionDescriptionInit }) => {
      console.log("Received answer.");
      pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    });

    socket.on("ice-candidate", (data: { candidate: RTCIceCandidateInit }) => {
      console.log("Received ICE candidate.");
      pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    });

    // 3. Set up listeners for the peer connection itself
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          room: roomId,
        });
      }
    };

    // 4. Join the room
    socket.emit("join-room", roomId);
  };

  return { startConnection };
}
