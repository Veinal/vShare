import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";

// This is a workaround to attach the socket.io server to the Next.js server
// The property 'server' does not exist on type 'Socket<...>'.
// We are extending the existing type to include our custom property.
interface ExtendedHttpServer extends HttpServer {
  io?: Server;
}

interface ExtendedSocket extends Socket {
  // You can add custom properties to the socket object here
}

export const GET = (_req: Request, res: any) => {
  // It's common to check if the server is already running in a development environment
  // to avoid creating multiple instances.
  if (res.socket.server.io) {
    console.log("Socket.IO server already running.");
  } else {
    console.log("Initializing Socket.IO server...");
    const io = new Server(res.socket.server as ExtendedHttpServer, {
      path: "/api/socket",
      addTrailingSlash: false,
    });

    res.socket.server.io = io;

    io.on("connection", (socket: ExtendedSocket) => {
      console.log("A user connected:", socket.id);

      socket.on("join-room", (room: string) => {
        console.log(`User ${socket.id} joining room ${room}`);
        socket.join(room);
        // Notify the other user in the room that a peer has joined.
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

      socket.on(
        "ice-candidate",
        (data: { candidate: any; room: string }) => {
          socket.to(data.room).emit("ice-candidate", {
            candidate: data.candidate,
            from: socket.id,
          });
        }
      );

      socket.on("disconnect", () => {
        console.log("A user disconnected:", socket.id);
        // Here you might want to notify the other user in the room.
      });
    });
  }
  res.end();
};
