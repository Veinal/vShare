const { Server } = require("socket.io");

// The port for the signaling server is 3001
const io = new Server(process.env.PORT || 3001, {
  cors: {
    origin: "*", // Allow all origins for simplicity. In production, you'd restrict this.
  },
});

console.log("Signaling server started on port 3001");

const rooms = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // A user wants to create a new session
  socket.on("create-session", (callback) => {
    // For this project, the session code is generated on the client,
    // but the server ensures it's unique.
    // The client will send the code it generated.
  });

  // A user wants to join an existing session
  socket.on("join-session", (sessionCode) => {
    let room = io.sockets.adapter.rooms.get(sessionCode);
    if (room && room.size < 2) {
      socket.join(sessionCode);
      console.log(`User ${socket.id} joined session: ${sessionCode}`);
      // Notify the other user in the room
      socket.to(sessionCode).emit("peer-joined", { peerId: socket.id });
    } else {
      // Room is full or doesn't exist
      socket.emit("session-error", "Invalid session code or session is full.");
    }
  });

  // A user wants to create and join a session
  socket.on("create-and-join", (sessionCode) => {
    let room = io.sockets.adapter.rooms.get(sessionCode);
    if (!room) {
        socket.join(sessionCode);
        console.log(`User ${socket.id} created and joined session: ${sessionCode}`);
        socket.emit("session-created", sessionCode);
    } else {
        socket.emit("session-error", "Session code already exists.");
    }
  });

  // Relay WebRTC offer
  socket.on("webrtc-offer", ({ sdp, sessionCode }) => {
    console.log(`Relaying WebRTC offer from ${socket.id} in session ${sessionCode}`);
    socket.to(sessionCode).emit("webrtc-offer", sdp);
  });

  // Relay WebRTC answer
  socket.on("webrtc-answer", ({ sdp, sessionCode }) => {
    console.log(`Relaying WebRTC answer from ${socket.id} in session ${sessionCode}`);
    socket.to(sessionCode).emit("webrtc-answer", sdp);
  });

  // Relay ICE candidates
  socket.on("webrtc-ice-candidate", ({ candidate, sessionCode }) => {
    console.log(`Relaying ICE candidate from ${socket.id} in session ${sessionCode}`);
    socket.to(sessionCode).emit("webrtc-ice-candidate", candidate);
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    // Find which room the user was in and notify the other peer
    // This is a simplified approach. A more robust solution would track this.
    // For now, the client will handle the disconnect event.
  });
});
