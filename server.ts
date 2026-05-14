import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true, // Support older clients if any
    connectTimeout: 45000
  });

  const PORT = 3000;

  // Store active rooms with their users and shared windows
  const rooms: Record<string, {
    users: Record<string, { x: number, y: number, username: string, health: number, isReady: boolean, cursorMode?: string }>,
    windows: Record<string, { isOpen: boolean, x: number | string, y: number | string, width?: number, height?: number, draggedBy?: string | null, openedBy?: string | null }>,
    physicsObjects: Record<string, any>
  }> = {};

  io.on("connection", (socket) => {
    let currentRoom: string | null = null;

    socket.on("join-server", ({ roomName, username }) => {
      // Leave previous room if any
      if (currentRoom) {
        socket.leave(currentRoom);
        if (rooms[currentRoom]) {
          delete rooms[currentRoom].users[socket.id];
          io.to(currentRoom).emit("user-disconnected", socket.id);
        }
      }

      currentRoom = roomName;
      socket.join(roomName);

      if (!rooms[roomName]) {
        rooms[roomName] = {
          users: {},
          windows: { 
            'my-computer': { isOpen: false, x: 100, y: 100, width: 400, height: 300, draggedBy: null, openedBy: null },
            'fights-exe': { isOpen: false, x: 300, y: 150, width: 500, height: 380, draggedBy: null, openedBy: null },
            'server-join': { isOpen: false, x: 250, y: 200, width: 350, height: 280, draggedBy: null, openedBy: null }
          },
          physicsObjects: {}
        };

        // Test server dummy mouse
        if (roomName === 'test') {
          rooms[roomName].users['dummy-bot'] = {
            x: 500,
            y: 500,
            username: 'Dummy Mouse (Bot)',
            health: 100,
            isReady: true,
            cursorMode: 'pointer'
          };
          // Make the bot move slightly
          setInterval(() => {
            if (rooms['test'] && rooms['test'].users['dummy-bot']) {
              rooms['test'].users['dummy-bot'].x += (Math.random() - 0.5) * 40;
              rooms['test'].users['dummy-bot'].y += (Math.random() - 0.5) * 40;
              // Keep in bounds
              rooms['test'].users['dummy-bot'].x = Math.max(100, Math.min(900, rooms['test'].users['dummy-bot'].x));
              rooms['test'].users['dummy-bot'].y = Math.max(100, Math.min(900, rooms['test'].users['dummy-bot'].y));
              io.to('test').emit('user-moved', { id: 'dummy-bot', pos: { x: rooms['test'].users['dummy-bot'].x, y: rooms['test'].users['dummy-bot'].y } });
            }
          }, 100);
        }
      }
      
      rooms[roomName].users[socket.id] = { 
        x: 0, 
        y: 0, 
        username: username || `Guest ${socket.id.slice(0, 4)}`,
        health: 100,
        isReady: false,
        cursorMode: 'pointer'
      };
      
      // Send existing state to the new user
      socket.emit("init-state", {
        users: rooms[roomName].users,
        windows: rooms[roomName].windows,
        physicsObjects: rooms[roomName].physicsObjects
      });
      
      // Notify the room
      socket.to(roomName).emit("user-joined", { id: socket.id, user: rooms[roomName].users[socket.id] });
      
      // If joining test room, also notify about dummy bot explicitly
      if (roomName === 'test') {
        socket.emit("user-joined", { id: 'dummy-bot', user: rooms[roomName].users['dummy-bot'] });
      }

      console.log(`User ${socket.id} joined room: ${roomName}`);
    });

    socket.on("mouse-move", (pos) => {
      if (!currentRoom || !rooms[currentRoom] || !rooms[currentRoom].users[socket.id]) return;
      rooms[currentRoom].users[socket.id].x = pos.x;
      rooms[currentRoom].users[socket.id].y = pos.y;
      rooms[currentRoom].users[socket.id].cursorMode = pos.mode;
      socket.to(currentRoom).emit("user-moved", { id: socket.id, pos });
    });

    socket.on("window-toggle", ({ id, state }) => {
      if (!currentRoom || !rooms[currentRoom]) return;
      if (id === 'server-join') return;

      if (!rooms[currentRoom].windows[id]) {
        rooms[currentRoom].windows[id] = { isOpen: state, x: 200, y: 200, openedBy: state ? socket.id : null };
      } else {
        rooms[currentRoom].windows[id].isOpen = state;
        rooms[currentRoom].windows[id].openedBy = state ? socket.id : null;
      }
      socket.to(currentRoom).emit("window-state-changed", { id, state, userId: socket.id });
    });

    socket.on("window-move", ({ id, pos }) => {
      if (!currentRoom || !rooms[currentRoom]) return;
      if (id === 'server-join') return;

      if (!rooms[currentRoom].windows[id]) {
        rooms[currentRoom].windows[id] = { isOpen: true, x: pos.x, y: pos.y };
      } else {
        rooms[currentRoom].windows[id].x = pos.x;
        rooms[currentRoom].windows[id].y = pos.y;
      }
      socket.to(currentRoom).emit("window-moved", { id, pos, userId: socket.id });
    });

    socket.on("window-resize", ({ id, size }) => {
      if (!currentRoom || !rooms[currentRoom]) return;
      if (!rooms[currentRoom].windows[id]) return;
      rooms[currentRoom].windows[id].width = size.width;
      rooms[currentRoom].windows[id].height = size.height;
      socket.to(currentRoom).emit("window-resized", { id, size });
    });

    socket.on("window-drag-start", ({ id }) => {
      if (!currentRoom || !rooms[currentRoom]) return;
      if (!rooms[currentRoom].windows[id]) return;
      rooms[currentRoom].windows[id].draggedBy = socket.id;
      socket.to(currentRoom).emit("window-drag-start", { id, userId: socket.id });
    });

    socket.on("window-drag-end", ({ id }) => {
      if (!currentRoom || !rooms[currentRoom]) return;
      if (!rooms[currentRoom].windows[id]) return;
      rooms[currentRoom].windows[id].draggedBy = null;
      socket.to(currentRoom).emit("window-drag-end", { id });
    });

    socket.on("add-physics-object", (obj) => {
      if (!currentRoom || !rooms[currentRoom]) return;
      obj.color = "black"; // Pencil drawing is always black
      rooms[currentRoom].physicsObjects[obj.id] = obj;
      io.to(currentRoom).emit("physics-object-added", obj);
    });

    socket.on("remove-physics-object", (id) => {
      if (!currentRoom || !rooms[currentRoom]) return;
      delete rooms[currentRoom].physicsObjects[id];
      io.to(currentRoom).emit("physics-object-removed", id);
    });

    socket.on("grab-physics-object", (id) => {
      if (!currentRoom || !rooms[currentRoom]) return;
      if (rooms[currentRoom].physicsObjects[id]) {
        rooms[currentRoom].physicsObjects[id].heldBy = socket.id;
        socket.to(currentRoom).emit("physics-object-grabbed", { id, userId: socket.id });
      }
    });

    socket.on("move-physics-object", ({ id, pos }) => {
      if (!currentRoom || !rooms[currentRoom]) return;
      if (rooms[currentRoom].physicsObjects[id]) {
        rooms[currentRoom].physicsObjects[id].x = pos.x;
        rooms[currentRoom].physicsObjects[id].y = pos.y;
        socket.to(currentRoom).emit("physics-object-moved", { id, pos });
      }
    });

    socket.on("throw-physics-object", ({ id, velocity }) => {
      if (!currentRoom || !rooms[currentRoom]) return;
      if (rooms[currentRoom].physicsObjects[id]) {
        rooms[currentRoom].physicsObjects[id].heldBy = null;
        rooms[currentRoom].physicsObjects[id].throwsRemaining -= 1;
        socket.to(currentRoom).emit("physics-object-thrown", { id, velocity });
        
        // Auto-remove if throws expired
        if (rooms[currentRoom].physicsObjects[id].throwsRemaining <= 0) {
          setTimeout(() => {
            if (rooms[currentRoom]?.physicsObjects[id]) {
              delete rooms[currentRoom].physicsObjects[id];
              io.to(currentRoom!).emit("physics-object-removed", id);
            }
          }, 1000);
        }
      }
    });

    socket.on("player-ready", (isReady) => {
      if (!currentRoom || !rooms[currentRoom] || !rooms[currentRoom].users[socket.id]) return;
      rooms[currentRoom].users[socket.id].isReady = isReady;
      io.to(currentRoom).emit("user-ready-changed", { id: socket.id, isReady });
    });

    socket.on("damage-player", ({ targetId, damage, effects, duration }: { targetId: string, damage: number, effects?: string[], duration?: number }) => {
      if (!currentRoom || !rooms[currentRoom] || !rooms[currentRoom].users[targetId]) return;
      const room = rooms[currentRoom];
      room.users[targetId].health = Math.max(0, room.users[targetId].health - damage);
      io.to(currentRoom).emit("user-health-changed", { id: targetId, health: room.users[targetId].health });

      if (effects && effects.length > 0) {
        effects.forEach((effect: string) => {
           io.to(currentRoom!).emit("user-effect", { userId: targetId, effect, duration: duration || 3000 });
        });
      }

      // Check for win condition: only one player with health > 0
      const players = Object.entries(room.users);
      const alivePlayers = players.filter(([id, u]) => u.health > 0);
      
      if (alivePlayers.length === 1 && players.length > 1) {
        const [winnerId, winner] = alivePlayers[0];
        io.to(currentRoom).emit("game-over", { winnerId, winnerName: winner.username });
      }
    });

    socket.on("user-effect", ({ userId, effect, duration }) => {
      if (!currentRoom) return;
      io.to(currentRoom).emit("user-effect", { userId, effect, duration });
    });

    socket.on("swipe-attack", ({ from, to }) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit("visual-swipe", { attackerId: socket.id, from, to });
    });

    socket.on("bsod-trigger", () => {
      if (!currentRoom || !rooms[currentRoom]) return;
      io.to(currentRoom).emit("bsod-start", { triggererId: socket.id });
    });

    socket.on("storm-trigger", () => {
      if (!currentRoom || !rooms[currentRoom]) return;
      io.to(currentRoom).emit("storm-start", { triggererId: socket.id });
    });

    socket.on("buy-server-item", ({ itemId }) => {
      if (!currentRoom || !rooms[currentRoom]) return;
      io.to(currentRoom).emit("server-item-unlocked", { itemId });
    });

    socket.on("reset-game", () => {
      if (!currentRoom || !rooms[currentRoom]) return;
      Object.keys(rooms[currentRoom].users).forEach(id => {
        rooms[currentRoom].users[id].health = 100;
        rooms[currentRoom].users[id].isReady = false;
      });
      io.to(currentRoom).emit("game-reset", rooms[currentRoom].users);
    });

    socket.on("force-move", ({ targetId, pos }) => {
      if (!currentRoom || !rooms[currentRoom] || !rooms[currentRoom].users[targetId]) return;
      rooms[currentRoom].users[targetId].x = pos.x;
      rooms[currentRoom].users[targetId].y = pos.y;
      io.to(currentRoom).emit("user-moved", { id: targetId, pos });
    });

    socket.on("disconnect", () => {
      if (currentRoom && rooms[currentRoom]) {
        delete rooms[currentRoom].users[socket.id];
        io.to(currentRoom).emit("user-disconnected", socket.id);
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
