// ========================================
// Dependencies
// ========================================
const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { RateLimiterMemory } = require('rate-limiter-flexible');

// ========================================
// Global Variables
// ========================================
const playerPoints = {
  // Format: { 'roomCode': { 'deviceId': points } }
};

// ========================================
// Server Configuration
// ========================================
// Rate Limiter Setup
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 Minute
  max: 500, // Request limit per IP
});

const rateLimiter = new RateLimiterMemory({
  points: 30,    // Anzahl erlaubter Events
  duration: 10,  // pro 10 Sekunden
});

// Express Setup
const app = express();
const server = http.createServer(app);

// ========================================
// Middleware Configuration
// ========================================
app.use(limiter);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], // Only resources from own domain
        scriptSrc: ["'self'", "'unsafe-inline'"], // JavaScript sources
        styleSrc: ["'self'", "'unsafe-inline'"], // CSS sources
        imgSrc: ["'self'", "data:", "https:"], // Image sources
        connectSrc: ["'self'", "wss:", "ws:"], // WebSocket connections
      },
    },
  })
);
app.use(express.static("public"));

// ========================================
// Server Port and Environment
// ========================================
const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

// ========================================
// Error Handling
// ========================================
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});

// ========================================
// Random Names Setup
// ========================================
let randomNames = [];
try {
  const namesData = fs.readFileSync(
    path.join(__dirname, "public/assets/data/random-names.json")
  );
  randomNames = JSON.parse(namesData).names;
} catch (error) {
  console.error("Error loading random names:", error);
  randomNames = ["Player"]; // Fallback
}

function getRandomName() {
  return randomNames[Math.floor(Math.random() * randomNames.length)];
}

// ========================================
// Room Management
// ========================================
const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function cleanupRooms() {
  for (const roomCode in rooms) {
    const room = rooms[roomCode];

    // Check if host is still connected
    if (!io.sockets.adapter.rooms.get(roomCode)?.has(room.host)) {
      deleteRoom(roomCode);
      continue;
    }

    // Check if there are still players in the room
    const connectedClients = io.sockets.adapter.rooms.get(roomCode)?.size || 0;
    if (connectedClients === 0) {
      deleteRoom(roomCode);
    }
  }
}

// Regular cleanup
setInterval(cleanupRooms, 30 * 60 * 1000); // Every 30 minutes

function deleteRoom(roomCode) {
  console.log(`Deleting room ${roomCode}`);
  io.to(roomCode).emit("room-closed");

  if (playerPoints[roomCode]) {
    delete playerPoints[roomCode];
    console.log(`Points cache cleared for room ${roomCode}`);
  }

  delete rooms[roomCode];
}

// Validation for JS
function validateGamemaster(socket, roomCode) {
  return rooms[roomCode] && rooms[roomCode].host === socket.id;
}

function validatePlayer(socket, roomCode) {
  return rooms[roomCode] && rooms[roomCode].players[socket.id] && rooms[roomCode].host !== socket.id;
}

function startRoomTimer(roomCode) {
  const INACTIVE_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
  setTimeout(() => {
    if (rooms[roomCode]) {
      const connectedClients =
        io.sockets.adapter.rooms.get(roomCode)?.size || 0;
      if (connectedClients === 0) {
        deleteRoom(roomCode);
      }
    }
  }, INACTIVE_TIMEOUT);
}

// ========================================
// Socket.IO Event Handlers
// ========================================
io.on("connection", (socket) => {
  // Rate Limiting für alle Events
  socket.use(async (_, next) => {
    try {
      await rateLimiter.consume(socket.id);
      next();
    } catch (error) {
      next(new Error('Rate limit exceeded'));
    }
  });

  // ----------------------------------------
  // Room Creation and Joining
  // ----------------------------------------
  socket.on("create-room", (data) => {
    try {
      if (!data?.playerName?.trim()) {
        throw new Error("Invalid player name");
      }

      const roomCode = generateRoomCode();
      console.log("Creating room with code:", roomCode);

      rooms[roomCode] = {
        host: socket.id,
        players: {},
        buzzerActive: true,
        notes: {},
        gamemasterNote: "",
        createdAt: Date.now(),
        timer: {
          active: false,
          endTime: null,
          duration: 0,
        },
        lockedAnswers: new Set(),
      };
      console.log("Room created. Current rooms:", Object.keys(rooms));

      currentRoom = roomCode;
      socket.join(roomCode);

      socket.emit("room-created", { roomCode });
      startRoomTimer(roomCode);
      console.log(`Room ${roomCode} created by ${data.playerName}`);
    } catch (error) {
      socket.emit("room-error", error.message);
      console.error("Room creation error:", error);
    }
  });

  socket.on("join-room", (data) => {
    try {
      const roomCode = data.roomCode.replace(/\s/g, "");
      console.log("Join attempt for room:", roomCode);
      console.log("Available rooms:", Object.keys(rooms));

      if (!roomCode) {
        throw new Error("Invalid room code");
      }

      const room = rooms[roomCode];
      if (!room) {
        throw new Error("Room does not exist");
      }

      const playerCount = Object.keys(room.players).length;
      if (playerCount >= 12) {
        throw new Error("Room is full (max 12 players)");
      }

      const playerName = data.playerName?.trim()
        ? data.playerName.trim()
        : getRandomName();

      room.players[socket.id] = {
        id: socket.id,
        name: playerName,
        points: playerPoints[roomCode]?.[data.deviceId] || 0,
        isHost: false,
        avatarId: data.avatarId,
        deviceId: data.deviceId,
      };

      currentRoom = roomCode;

      socket.emit("join-success", { roomCode: roomCode });

      room.notes[socket.id] = {
        text: "",
        playerName: playerName,
        locked: false,
      };

      socket.join(roomCode);
      io.to(roomCode).emit("player-list-update", room.players);
      socket.emit("gamemaster-note-update", { text: room.gamemasterNote });
      io.to(room.host).emit("notes-update", room.notes);

      console.log(`Player ${playerName} joined room ${roomCode}`);
    } catch (error) {
      socket.emit("room-error", error.message);
      console.error("Join room error:", error);
    }
  });

  // ----------------------------------------
  // Answer Locking Handlers
  // ----------------------------------------
  socket.on("lock-player-answer", (data) => {
    console.log("Received lock answer:", data);
    try {
      if (!validatePlayer(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only players can lock their answers");
        return;
      }
      const room = rooms[data.roomCode];
      room.lockedAnswers.add(socket.id);
      if (room.notes[socket.id]) {
        room.notes[socket.id].locked = true;
      }
      io.to(data.roomCode).emit("player-answer-locked", { playerId: socket.id });
      io.to(room.host).emit("notes-update", room.notes);
    } catch (error) {
      console.error("Lock answer error:", error);
    }
  });

  socket.on("lock-all-answers", (data) => {
    try {
      if (!validateGamemaster(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only gamemaster can lock all answers");
        return;
      }
      const room = rooms[data.roomCode];
      Object.keys(room.players).forEach((playerId) => {
        if (playerId !== room.host) {
          room.lockedAnswers.add(playerId);
          if (room.notes[playerId]) {
            room.notes[playerId].locked = true;
          }
        }
      });
      io.to(data.roomCode).emit("all-answers-locked");
      io.to(room.host).emit("notes-update", room.notes);
    } catch (error) {
      console.error("Lock all answers error:", error);
    }
  });

  socket.on("unlock-all-answers", (data) => {
    try {
      if (!validateGamemaster(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only gamemaster can unlock answers");
        return;
      }
      const room = rooms[data.roomCode];
      room.lockedAnswers.clear();
      Object.keys(room.notes).forEach((playerId) => {
        if (room.notes[playerId]) {
          room.notes[playerId].locked = false;
        }
      });
      io.to(data.roomCode).emit("all-answers-unlocked");
      io.to(room.host).emit("notes-update", room.notes);
    } catch (error) {
      console.error("Unlock all answers error:", error);
    }
  });

  // ----------------------------------------
  // Note Update Handlers
  // ----------------------------------------
  socket.on("update-note", (data) => {
    console.log("Received note update:", data);
    try {
      if (!validatePlayer(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only players can update notes");
        return;
      }
      const room = rooms[data.roomCode];
      const playerName = room.notes[socket.id].playerName;
      room.notes[socket.id] = {
        text: data.text,
        playerName: playerName,
      };
      io.to(room.host).emit("notes-update", room.notes);
    } catch (error) {
      console.error("Note update error:", error);
    }
  });

  socket.on("update-gamemaster-note", (data) => {
    try {
      if (!validateGamemaster(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only gamemaster can update gamemaster notes");
        return;
      }
      const room = rooms[data.roomCode];
      room.gamemasterNote = data.text;
      io.to(data.roomCode).emit("gamemaster-note-update", { text: data.text });
    } catch (error) {
      console.error("Gamemaster note update error:", error);
    }
  });

  // ----------------------------------------
  // Buzzer Handlers
  // ----------------------------------------
  socket.on("press-buzzer", (data) => {
    console.log("Received buzzer press:", data);
    try {
      if (!validatePlayer(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only players can press the buzzer");
        return;
      }
      const room = rooms[data.roomCode];
      if (room && room.buzzerActive) {
        room.buzzerActive = false;
        io.to(data.roomCode).emit("buzzer-pressed", {
          playerId: socket.id,
          playerName: room.players[socket.id].name,
        });
      }
    } catch (error) {
      console.error("Buzzer error:", error);
    }
  });

  socket.on("release-buzzers", (data) => {
    try {
      if (!validateGamemaster(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only gamemaster can release buzzers");
        return;
      }
      const room = rooms[data.roomCode];
      room.buzzerActive = true;
      io.to(data.roomCode).emit("buzzers-released");
    } catch (error) {
      console.error("Release buzzers error:", error);
    }
  });

  socket.on("lock-buzzers", (data) => {
    try {
      if (!validateGamemaster(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only gamemaster can lock buzzers");
        return;
      }
      const room = rooms[data.roomCode];
      room.buzzerActive = false;
      io.to(data.roomCode).emit("buzzers-locked");
    } catch (error) {
      console.error("Lock buzzers error:", error);
    }
  });

  // ----------------------------------------
  // Points and Timer Handlers
  // ----------------------------------------
  socket.on("update-points", (data) => {
    try {
      if (!validateGamemaster(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only gamemaster can update points");
        return;
      }
      const { roomCode, playerId, points } = data;
      const room = rooms[roomCode];
      room.players[playerId].points += points;

      const deviceId = room.players[playerId].deviceId;
      if (deviceId) {
        if (!playerPoints[roomCode]) {
          playerPoints[roomCode] = {};
        }
        playerPoints[roomCode][deviceId] = room.players[playerId].points;
      }
      io.to(roomCode).emit("player-list-update", room.players);
    } catch (error) {
      console.error("Update points error:", error);
    }
  });

  socket.on("start-timer", (data) => {
    try {
      if (!validateGamemaster(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only gamemaster can start the timer");
        return;
      }
      const { roomCode, duration } = data;
      const room = rooms[roomCode];
      io.to(roomCode).emit("timer-started", {
        duration: duration,
      });
    } catch (error) {
      console.error("Timer error:", error);
    }
  });

  socket.on("reset-timer", (data) => {
    try {
      if (!validateGamemaster(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only gamemaster can reset the timer");
        return;
      }
      const { roomCode } = data;
      const room = rooms[roomCode];
      io.to(roomCode).emit("timer-reset");
    } catch (error) {
      console.error("Timer reset error:", error);
    }
  });

  // ----------------------------------------
  // Random Number Generator
  // ----------------------------------------
  socket.on("generate-number", (data) => {
    try {
      if (!validateGamemaster(socket, data.roomCode)) {
        socket.emit("room-error", "Unauthorized: Only gamemaster can generate numbers");
        return;
      }
      const room = rooms[data.roomCode];
      const min = Math.ceil(data.min);
      const max = Math.floor(data.max);
      const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
      io.to(data.roomCode).emit("number-generated", { number: randomNumber });
    } catch (error) {
      console.error("Random number generation error:", error);
    }
  });

  // ----------------------------------------
  // Disconnection Handler
  // ----------------------------------------
  socket.on("disconnect", () => {
    try {
      if (currentRoom && rooms[currentRoom]) {
        const room = rooms[currentRoom];

        // When a player disconnects
        if (room.players[socket.id]) {
          delete room.notes[socket.id];
          delete room.players[socket.id];
          io.to(currentRoom).emit("player-list-update", room.players);
          io.to(room.host).emit("notes-update", room.notes);
        }

        // When the host disconnects
        if (room.host === socket.id) {
          deleteRoom(currentRoom);
        }

        // Check if room is empty
        const connectedClients =
          io.sockets.adapter.rooms.get(currentRoom)?.size || 0;
        if (connectedClients === 0) {
          deleteRoom(currentRoom);
        }
      }
      console.log("Client disconnected");
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  });
});

// ========================================
// Server Startup
// ========================================
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
});
