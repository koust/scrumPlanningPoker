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
            hasVoted: user.vote !== null,
            vote: user.vote
        })));
        io.to(room).emit('chatMessage', { user: 'System', message: `${userName} joined the room.` });
    
    });


    socket.on('heartbeat', () => {
        // console.log('Heartbeat alındı:', socket.id);
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
        rooms[room][socket.id].vote = parseFloat(vote, 10); // Store vote
        console.log(`Vote received in room ${room} by ${rooms[room][socket.id].name}: ${vote}`);
        io.to(room).emit('userListUpdate', Object.values(rooms[room]));
    });

    // Reveal votes in a room

    socket.on('revealVotes', (room) => {
        if (rooms[room]) {
            revealed[room] = true;
            const allVotes = Object.values(rooms[room]).map(user => user.vote).filter(v => v !== null);
            const validVotes = allVotes.filter(v => v !== 0);
            const average = validVotes.length ? (validVotes.reduce((sum, v) => sum + v, 0) / validVotes.length).toFixed(2) : 0;
            
            console.log(`Oda ${room} - Toplam oy: ${allVotes.length}, Geçerli oy: ${validVotes.length}, Ortalama: ${average}`);

            io.to(room).emit('updateVotes', {
                votes: Object.values(rooms[room]),
                average,
                revealed: true
            });

            io.to(room).emit('chatMessage', { user: 'System', message: `The result will be deleted after 5 seconds.` });
            setTimeout(() => {
                if (rooms[room]) {
                    Object.values(rooms[room]).forEach(user => user.vote = null); // Clear all votes
                    revealed[room] = false; // Reset reveal status
                    io.to(room).emit('userListUpdate', Object.values(rooms[room]).map(user => ({
                        name: user.name,
                        hasVoted: user.vote !== null,
                        vote: null
                    })));
                    io.to(room).emit('updateVotes', { votes: Object.values(rooms[room]), average: 0, revealed: false });
                    io.to(room).emit('chatMessage', { user: 'System', message: `Voting has been restarted.` });
                }
            }, 5000); // 5 saniye
        }
    });

    // Clear votes in a room
    socket.on('clearVotes', (room) => {
        if (rooms[room]) {
            Object.values(rooms[room]).forEach(user => user.vote = null); // Clear all votes
            revealed[room] = false; // Reset reveal status
            io.to(room).emit('userListUpdate', Object.values(rooms[room]).map(user => ({
                name: user.name,
                hasVoted: user.vote !== null,
                vote: null
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

    // Kullanıcı adı güncelleme
    socket.on('updateUsername', ({ room, newUsername }) => {
        if (rooms[room] && rooms[room][socket.id]) {
            const oldUsername = rooms[room][socket.id].name;
            rooms[room][socket.id].name = newUsername;

            // Kullanıcı listesi ve mesajları güncelle
            io.to(room).emit('userListUpdate', Object.values(rooms[room]).map(user => ({
                name: user.name,
                hasVoted: user.vote !== null,
                vote: user.vote
            })));

            io.to(room).emit('chatMessage', { user: 'System', message: `${oldUsername} is now ${newUsername}` });
        }
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
   console.log('Server is running on http://localhost:8080');
});
