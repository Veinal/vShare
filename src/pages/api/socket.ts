import { Server as NetServer } from "http";
import { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";

export const config = {
  api: {
    bodyParser: false,
  },
};

const SocketIOHandler = (req: NextApiRequest, res: NextApiResponse & { socket: { server: NetServer & { io: ServerIO } } }) => {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  const path = "/api/socket";
  const httpServer: NetServer = res.socket.server;
  const io = new ServerIO(httpServer, {
    path,
    addTrailingSlash: false,
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-room", (room: string) => {
      const upperCaseRoom = room.toUpperCase();
      console.log(`User ${socket.id} joining room ${upperCaseRoom}`);
      socket.join(upperCaseRoom);
      socket.to(upperCaseRoom).emit("peer-joined", socket.id);
    });

    socket.on("offer", (data: { sdp: any; room: string }) => {
      const upperCaseRoom = data.room.toUpperCase();
      console.log(`User ${socket.id} sending offer to room ${upperCaseRoom}`);
      socket.to(upperCaseRoom).emit("offer", { sdp: data.sdp, from: socket.id });
    });

    socket.on("answer", (data: { sdp: any; room: string }) => {
      const upperCaseRoom = data.room.toUpperCase();
      console.log(`User ${socket.id} sending answer to room ${upperCaseRoom}`);
      socket.to(upperCaseRoom).emit("answer", { sdp: data.sdp, from: socket.id });
    });

    socket.on("ice-candidate", (data: { candidate: any; room: string }) => {
      const upperCaseRoom = data.room.toUpperCase();
      socket.to(upperCaseRoom).emit("ice-candidate", {
        candidate: data.candidate,
        from: socket.id,
      });
    });

    socket.on("disconnect", () => {
      console.log("A user disconnected:", socket.id);
    });
  });

  res.socket.server.io = io;
  res.end();
};

export default SocketIOHandler;