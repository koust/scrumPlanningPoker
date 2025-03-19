// Backend (server.js)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Global değişkenler
const rooms = {};
const revealed = {}; // Oda başına oyların açık olup olmadığını tutar
let chatMessages = {}; // Store chat messages per room

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Odadaki Scrum Master sayısını kontrol et
    socket.on('checkScrumMasterCount', (room, callback) => {
        const scrumMasterCount = Object.values(rooms[room] || {})
            .filter(user => user.role === 'scrumMaster')
            .length;
        
        console.log(`Room ${room} has ${scrumMasterCount} Scrum Masters`);
        callback(scrumMasterCount);
    });

    // Register user name
    socket.on('registerUser', ({ room, userName, role }) => {
        socket.join(room);

        if (!rooms[room]) {
            rooms[room] = {};
            revealed[room] = false;
            chatMessages[room] = []; // Initialize chat messages for the room
        }

        rooms[room][socket.id] = { 
            name: userName, 
            vote: null, 
            role: role || 'developer' // Role değeri yoksa varsayılan olarak developer
        };
        
        io.to(room).emit('userListUpdate', Object.values(rooms[room]).map(user => ({
            name: user.name,
            hasVoted: user.vote !== null,
            vote: user.vote,
            role: user.role // Rol bilgisini de gönder
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

    // Reveal votes
    socket.on('revealVotes', (room) => {
        if (rooms[room]) {
            const votes = Object.values(rooms[room])
                .filter(user => user.vote !== null && user.vote !== 0); // Oy verenleri filtrele ve mola isteyenleri çıkar

            // Sadece developer rolündeki kullanıcıların oylarını değerlendirmeye al
            const developerVotes = votes.filter(user => user.role === 'developer' && user.vote !== null && user.vote !== 0);
            
            if (developerVotes.length > 0) {
                const sum = developerVotes.reduce((acc, user) => acc + user.vote, 0);
                const average = Math.round((sum / developerVotes.length) * 10) / 10; // Ortalamayı 1 ondalık basamağa yuvarla
                // const userVotes = Object.values(rooms[room])
                //     .map(user => {
                //         if (user.vote === null) {
                //             return `<strong>${user.name}</strong>: Oy vermedi`;
                //         } else if (user.vote === 0) {
                //             return `<strong>${user.name} (${user.role === 'scrumMaster' ? 'SM' : 'Dev'})</strong>: ☕️ (Mola istiyor)`;
                //         }
                //         return `<strong>${user.name} (${user.role === 'scrumMaster' ? 'SM' : 'Dev'})</strong>: ${user.vote}`;
                //     })
                //     .join('<br>');

                io.to(room).emit('updateVotes', { votes: Object.values(rooms[room]), average, revealed: true });
            } else {
                io.to(room).emit('chatMessage', { user: 'System', message: 'Hiçbir developer oy vermedi!' });
                io.to(room).emit('updateVotes', { votes: Object.values(rooms[room]), average: 0, revealed: true });
            }

            io.to(room).emit('chatMessage', { user: 'System', message: 'Sonuçlar 5 saniye sonra silinecek.' });
            setTimeout(() => {
                if (rooms[room]) {
                    Object.values(rooms[room]).forEach(user => user.vote = null); // Clear all votes
                    revealed[room] = false; // Reset reveal status
                    io.to(room).emit('userListUpdate', Object.values(rooms[room]).map(user => ({
                        name: user.name,
                        hasVoted: user.vote !== null,
                        vote: null,
                        role: user.role
                    })));
                    io.to(room).emit('updateVotes', { votes: Object.values(rooms[room]), average: 0, revealed: false });
                    io.to(room).emit('chatMessage', { user: 'System', message: `Yeni oylama başlatıldı.` });
                }
            }, 5000);
        }
    });

    // Clear votes
    socket.on('clearVotes', (room) => {
        if (rooms[room]) {
            // Tüm kullanıcıların oylarını sıfırla
            Object.values(rooms[room]).forEach(user => user.vote = null);
            revealed[room] = false; // Reset reveal status
            
            // Kullanıcı listesini güncelle
            io.to(room).emit('userListUpdate', Object.values(rooms[room]).map(user => ({
                name: user.name,
                hasVoted: false,
                vote: null,
                role: user.role
            })));
            
            // Oyları güncelle
            io.to(room).emit('updateVotes', { 
                votes: Object.values(rooms[room]), 
                average: 0, 
                revealed: false 
            });
            
            // Sohbete bilgi mesajı gönder
            io.to(room).emit('chatMessage', { 
                user: 'System', 
                message: `Oylar temizlendi. Yeni tur başladı.` 
            });
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
                vote: user.vote,
                role: user.role // Rol bilgisini içermeli
            })));

            io.to(room).emit('chatMessage', { user: 'System', message: `${oldUsername} is now ${newUsername}` });
        }
    });

    // Rol değişikliği
    socket.on('changeRole', ({ room, userName, newRole }) => {
        if (rooms[room] && rooms[room][socket.id]) {
            // Eğer Scrum Master olmak istiyorsa kontrol et
            if (newRole === 'scrumMaster') {
                const scrumMasterCount = Object.values(rooms[room])
                    .filter(user => user.role === 'scrumMaster' && user.name !== userName)
                    .length;
                
                if (scrumMasterCount >= 2) {
                    // Scrum Master limiti dolu, değişikliği reddet
                    socket.emit('roleUpdated', rooms[room][socket.id].role);
                    return;
                }
            }
            
            // Rol değişikliğini kaydet
            const oldRole = rooms[room][socket.id].role;
            rooms[room][socket.id].role = newRole;
            
            // Kullanıcıya rol değişikliğini bildir
            socket.emit('roleUpdated', newRole);
            
            // Odadaki diğer kullanıcılara rol değişikliğini bildir
            io.to(room).emit('userListUpdate', Object.values(rooms[room]).map(user => ({
                name: user.name,
                hasVoted: user.vote !== null,
                vote: user.vote,
                role: user.role
            })));
            
            // Rol değişikliğini sohbete bildir
            io.to(room).emit('chatMessage', { 
                user: 'System', 
                message: `${userName} şimdi bir ${newRole === 'developer' ? 'Developer' : 'Scrum Master'}.` 
            });
            
            console.log(`${userName} changed role from ${oldRole} to ${newRole} in room ${room}`);
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
