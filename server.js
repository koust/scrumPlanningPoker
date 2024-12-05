// Backend (server.js)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let rooms = {}; // Store votes per room
let revealed = {}; // Store reveal status per room
let chatMessages = {}; // Store chat messages per room

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Register user name
    socket.on('registerUser', ({ room, userName }) => {
        socket.join(room);

        if (!rooms[room]) {
            rooms[room] = {};
            revealed[room] = false;
            chatMessages[room] = []; // Initialize chat messages for the room
        }

        rooms[room][socket.id] = { name: userName, vote: null };
        io.to(room).emit('userListUpdate', Object.values(rooms[room]).map(user => ({
            name: user.name,
            hasVoted: user.vote !== null
        })));
        io.to(room).emit('chatMessage', { user: 'System', message: `${userName} joined the room.` });
    
    });

    // Listen for a vote
    socket.on('vote', ({ room, vote }) => {
        if (!rooms[room]) {
            console.error(`Room ${room} does not exist.`);
            return; // Room must exist
        }
        if (!rooms[room][socket.id]) {
            console.error(`User in room ${room} does not exist.`);
            return; // User must exist
        }
        rooms[room][socket.id].hasVoted = true 
        rooms[room][socket.id].vote = parseInt(vote, 10); // Store vote
        console.log(`Vote received in room ${room} by ${rooms[room][socket.id].name}: ${vote}`);
        io.to(room).emit('userListUpdate', Object.values(rooms[room]));
    });

    // Reveal votes in a room

    socket.on('revealVotes', (room) => {
        if (rooms[room]) {
            revealed[room] = true;
            const votes = Object.values(rooms[room]).map(user => user.vote).filter(v => v !== null);
            const average = votes.length ? (votes.reduce((sum, v) => sum + v, 0) / votes.length).toFixed(2) : 0;

            io.to(room).emit('updateVotes', {
                votes: Object.values(rooms[room]),
                average,
                revealed: true
            });
        }
    });

    // Clear votes in a room
    socket.on('clearVotes', (room) => {
        if (rooms[room]) {
            Object.values(rooms[room]).forEach(user => user.vote = null); // Clear all votes
            revealed[room] = false; // Reset reveal status
            io.to(room).emit('userListUpdate', Object.values(rooms[room]).map(user => ({
                name: user.name,
                hasVoted: user.vote !== null
            })));
            io.to(room).emit('updateVotes', { votes: Object.values(rooms[room]), average: 0, revealed: false });
        }
    });

    // Chat functionality
    socket.on('chatMessage', ({ room, message }) => {
        if (!chatMessages[room]) {
            chatMessages[room] = []; // Ensure chatMessages[room] exists
        }

        const user = rooms[room]?.[socket.id]?.name || 'Unknown';
        const chatMessage = { user, message };

        chatMessages[room].push(chatMessage); // Store chat message
        io.to(room).emit('chatMessage', chatMessage); // Broadcast chat message
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        for (const room in rooms) {
            if (rooms[room][socket.id]) {
                const userName = rooms[room][socket.id].name;
                delete rooms[room][socket.id];
                io.to(room).emit('userListUpdate', Object.values(rooms[room]));
                io.to(room).emit('chatMessage', { user: 'System', message: `${userName} left the room.` });
            }
        }
    });
});

// Serve static files (frontend)
app.use(express.static('public'));

server.listen(8080, () => {
   console.log('Server is running on http://localhost:4000');
});
