const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── GIF Proxy (hides Giphy calls from network filters) ──
app.get('/api/gif/search', async (req, res) => {
  try {
    const query = encodeURIComponent(req.query.q || 'funny');
    const limit = req.query.limit || 20;
    const apiKey = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'; // public beta key
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${query}&limit=${limit}&rating=g`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'proxy_error' });
  }
});

app.get('/api/gif/trending', async (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const apiKey = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65';
    const url = `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&rating=g`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'proxy_error' });
  }
});

// ── Health check (disguised) ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'document_service_active', version: '2.1.4' });
});

// ── In-memory room tracking (ZERO persistence) ──
const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUsername = null;

  // Join room — payload is disguised as a document event
  socket.on('autosave_event', (payload) => {
    try {
      const data = JSON.parse(Buffer.from(payload.content, 'base64').toString());

      if (data.type === 'join') {
        currentRoom = data.roomId;
        currentUsername = data.username;
        socket.join(currentRoom);

        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }
        rooms.get(currentRoom).add(currentUsername);

        // Broadcast user list update (disguised)
        const userList = Array.from(rooms.get(currentRoom));
        const response = Buffer.from(JSON.stringify({
          type: 'user_list',
          users: userList,
        })).toString('base64');

        io.to(currentRoom).emit('document_update', { content: response });

        // Notify room about new join
        const joinNotif = Buffer.from(JSON.stringify({
          type: 'system',
          text: `${currentUsername} joined the document`,
          timestamp: Date.now(),
        })).toString('base64');

        socket.to(currentRoom).emit('document_update', { content: joinNotif });
      }

      if (data.type === 'message' && currentRoom) {
        // Relay encrypted message — server NEVER sees plaintext
        const relay = Buffer.from(JSON.stringify({
          type: 'message',
          from: currentUsername,
          encrypted: data.encrypted, // opaque ciphertext
          iv: data.iv,
          timestamp: Date.now(),
          id: data.id,
        })).toString('base64');

        socket.to(currentRoom).emit('document_update', { content: relay });
      }

      if (data.type === 'typing' && currentRoom) {
        const typing = Buffer.from(JSON.stringify({
          type: 'typing',
          from: currentUsername,
          isTyping: data.isTyping,
        })).toString('base64');

        socket.to(currentRoom).emit('document_update', { content: typing });
      }

      if (data.type === 'doc_update' && currentRoom) {
        const docUpdate = Buffer.from(JSON.stringify({
          type: 'doc_update',
          from: currentUsername,
          html: data.html,
        })).toString('base64');

        socket.to(currentRoom).emit('document_update', { content: docUpdate });
      }
    } catch (e) {
      // Silent fail — no logs
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(currentUsername);

      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      } else {
        // Broadcast updated user list
        const userList = Array.from(rooms.get(currentRoom));
        const response = Buffer.from(JSON.stringify({
          type: 'user_list',
          users: userList,
        })).toString('base64');
        io.to(currentRoom).emit('document_update', { content: response });

        // Notify room about departure
        const leaveNotif = Buffer.from(JSON.stringify({
          type: 'system',
          text: `${currentUsername} left the document`,
          timestamp: Date.now(),
        })).toString('base64');
        io.to(currentRoom).emit('document_update', { content: leaveNotif });
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  // Intentionally bland log
  console.log(`Document sync service running on port ${PORT}`);
});
