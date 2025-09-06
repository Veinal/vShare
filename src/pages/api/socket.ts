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
      console.log(`User ${socket.id} joining room ${room}`);
      socket.join(room);
      socket.to(room).emit("peer-joined", socket.id);
    });

    socket.on("offer", (data: { sdp: any; room: string }) => {
      console.log(`User ${socket.id} sending offer to room ${data.room}`);
      socket.to(data.room).emit("offer", { sdp: data.sdp, from: socket.id });
    });

    socket.on("answer", (data: { sdp: any; room: string }) => {
      console.log(`User ${socket.id} sending answer to room ${data.room}`);
      socket.to(data.room).emit("answer", { sdp: data.sdp, from: socket.id });
    });

    socket.on("ice-candidate", (data: { candidate: any; room: string }) => {
      socket.to(data.room).emit("ice-candidate", {
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