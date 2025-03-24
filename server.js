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
const roomConfigs = {}; // Oda konfigürasyonlarını tutacak obje

// Sistem komutları için yardımcı fonksiyonlar
const systemCommands = {
    makeit: (room, params) => {
        if (!roomConfigs[room]) {
            roomConfigs[room] = {};
        }
        
        const [property, value] = params;
        if (property && value) {
            roomConfigs[room][property] = value;
            return {
                type: 'config',
                property,
                value,
                message: `${property} değeri ${value} olarak güncellendi.`
            };
        }
        return {
            type: 'error',
            message: 'Geçersiz komut formatı. Örnek: /makeit backgroundColor red'
        };
    },
    
    play: (room, params) => {
        if (!roomConfigs[room]) {
            roomConfigs[room] = {};
        }

        const [url] = params;
        if (!url) {
            return {
                type: 'error',
                message: 'Geçersiz komut formatı. Örnek: /play https://www.youtube.com/watch?v=VIDEO_ID'
            };
        }

        // YouTube URL'sinden video ID'sini çıkar
        let videoId = '';
        if (url.includes('youtube.com/watch?v=')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else {
            return {
                type: 'error',
                message: 'Geçersiz YouTube URL\'si. Örnek: https://www.youtube.com/watch?v=VIDEO_ID'
            };
        }

        roomConfigs[room].youtubeVideo = videoId;
        return {
            type: 'config',
            property: 'youtubeVideo',
            value: videoId,
            message: 'YouTube videosu oynatılıyor...'
        };
    },

    stop: (room) => {
        console.log('Stop komutu (systemCommands) çağrıldı');
        
        if (!roomConfigs[room]) {
            roomConfigs[room] = {};
        }

        // Her durumda video ID'sini sil
        delete roomConfigs[room].youtubeVideo;
        
        return {
            type: 'config',
            property: 'youtubeVideo',
            value: null,
            message: 'Video oynatma tüm kullanıcılarda durduruldu.',
            configs: roomConfigs[room]
        };
    },
    
    reset: (room) => {
        if (roomConfigs[room]) {
            // Varsayılan değerleri ayarla
            const defaultConfigs = {
                backgroundColor: '#f8f9fa',
                textColor: '#212529',
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                cardColor: '#ffffff',
                tableColor: '#0a5026',
                chairColor: '#ffffff'
            };
            
            roomConfigs[room] = defaultConfigs;
            
            return {
                type: 'config',
                message: 'Tüm konfigürasyonlar varsayılan değerlere sıfırlandı.',
                configs: defaultConfigs
            };
        }
        return {
            type: 'error',
            message: 'Sıfırlanacak konfigürasyon bulunamadı.'
        };
    },
    
    show: (room) => {
        if (roomConfigs[room] && Object.keys(roomConfigs[room]).length > 0) {
            const configs = Object.entries(roomConfigs[room])
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
            return {
                type: 'config',
                message: `Mevcut konfigürasyonlar:\n${configs}`
            };
        }
        return {
            type: 'error',
            message: 'Henüz hiç konfigürasyon yapılmamış.'
        };
    }
};

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
            chatMessages[room] = [];
        }

        const user = rooms[room]?.[socket.id]?.name || 'Unknown';
        
        // Sistem komutu kontrolü
        if (message.startsWith('/')) {
            const [command, ...params] = message.slice(1).split(' ');
            
            if (systemCommands[command]) {
                const result = systemCommands[command](room, params);
                
                if (result.type === 'config') {
                    // Konfigürasyon değişikliğini tüm kullanıcılara bildir
                    io.to(room).emit('configUpdate', {
                        room,
                        configs: roomConfigs[room]
                    });
                    
                    // Sistem mesajını gönder
                    io.to(room).emit('chatMessage', {
                        user: 'System',
                        message: result.message
                    });
                } else {
                    // Hata mesajını gönder
                    socket.emit('chatMessage', {
                        user: 'System',
                        message: result.message
                    });
                }
                return;
            } else if (command === 'stop') {
                console.log('Stop komutu alındı - tüm clientlarda video durduruluyor');
                
                // YouTube video ID'sini sil ve tüm clientlara bildir
                if (roomConfigs[room]) {
                    // YouTube ID'sini kontrol etmeden direk siliyoruz
                    delete roomConfigs[room].youtubeVideo;
                    
                    // Tüm kullanıcılara config güncellemesi gönder - youtubeVideo:null 
                    io.to(room).emit('configUpdate', {
                        room,
                        configs: {
                            youtubeVideo: null
                        }
                    });
                    
                    // Bildirim mesajı
                    io.to(room).emit('chatMessage', {
                        user: 'System',
                        message: 'Video oynatma tüm kullanıcılarda durduruldu.'
                    });
                } else {
                    // Odanın konfig listesi yoksa oluştur
                    roomConfigs[room] = {};
                    io.to(room).emit('configUpdate', {
                        room,
                        configs: {
                            youtubeVideo: null
                        }
                    });
                    
                    io.to(room).emit('chatMessage', {
                        user: 'System',
                        message: 'Video oynatma durduruldu.'
                    });
                }
                return;
            }
        }

        const chatMessage = { user, message };
        chatMessages[room].push(chatMessage);
        io.to(room).emit('chatMessage', chatMessage);
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
