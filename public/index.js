// Planning Poker Ana JS Dosyası
// Socket.io bağlantısı ve ana işlevsellik

// DOM elementleri
const chatInput = document.getElementById('chatInput');
const sendChat = document.getElementById('sendChat');
const chatMessages = document.getElementById('chatMessages');
const emojiButton = document.getElementById('emojiButton');
const emojiPicker = document.getElementById('emojiPicker');
const updateUsernameButton = document.getElementById('updateUsernameButton');
const newUsernameInput = document.getElementById('newUsernameInput');
const joinRoomButton = document.getElementById('joinRoom');
const userNameInput = document.getElementById('userName');
const roomInput = document.getElementById('room');
const toggleSoundButton = document.getElementById('toggleSound');
const roomInfo = document.getElementById('roomInfo');
const table = document.getElementById('table');
const userList = document.getElementById('userList');
const averageDisplay = document.getElementById('average');
const revealVotesButton = document.getElementById('revealVotes');
const clearVotesButton = document.getElementById('clearVotes');
const changeNameBtn = document.getElementById('changeNameBtn');
const namePopup = document.getElementById('namePopup');
const popupClose = document.querySelector('.popup-close');
const lastVoteResults = document.getElementById('lastVoteResults'); // Son oylama sonuçları
const scrumMasterArea = document.getElementById('scrumMasterArea'); // Scrum Master alanı
const roleWarning = document.getElementById('roleWarning'); // Rol uyarısı

// Global değişkenler
let currentRoom = null;
let currentUsername = null;
let userRegistered = false;
let soundEnabled = true;
let currentRole = 'developer'; // Varsayılan rol

// Web Audio API ile basit sesler oluşturacak yardımcı fonksiyon
function createAudioContext() {
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        return new AudioContext();
    } catch (e) {
        console.warn("Web Audio API desteklenmiyor, sesler çalınmayacak");
        return null;
    }
}

// Ses açma/kapatma fonksiyonu
function toggleSound() {
    soundEnabled = !soundEnabled;
    toggleSoundButton.innerHTML = soundEnabled ? 
        '<i class="fas fa-volume-up"></i>' : 
        '<i class="fas fa-volume-mute"></i>';
    toggleSoundButton.style.backgroundColor = soundEnabled ? 
        'var(--primary-color)' : 'var(--danger-color)';
    
    // Ses değişikliğini bildir
    if (soundEnabled) {
        playMessageSentSound(); // Kısa bir bildirim çal
    }
}

// Basit ses efektleri tanımla (Web Audio API ile)
function playMessageSentSound() {
    if (!soundEnabled) return;
    try {
        const audioContext = createAudioContext();
        if (!audioContext) return;
        
        // Kısa yüksek bir bip sesi
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        
        setTimeout(() => {
            oscillator.stop();
        }, 100);
    } catch (e) {
        console.error("Ses çalma hatası:", e);
    }
}

function playMessageReceivedSound() {
    if (!soundEnabled) return;
    try {
        const audioContext = createAudioContext();
        if (!audioContext) return;
        
        // İki tonlu bildirim sesi
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 700;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        
        setTimeout(() => {
            oscillator.frequency.value = 900;
            setTimeout(() => {
                oscillator.stop();
            }, 100);
        }, 100);
    } catch (e) {
        console.error("Ses çalma hatası:", e);
    }
}

function playSpinSound() {
    if (!soundEnabled) return;
    try {
        const audioContext = createAudioContext();
        if (!audioContext) return;
        
        // Döndürme sesi - yükselen ton
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 300;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        
        // Frekansı kademeli olarak artır
        const startTime = audioContext.currentTime;
        oscillator.frequency.setValueAtTime(300, startTime);
        oscillator.frequency.linearRampToValueAtTime(800, startTime + 1.5);
        
        setTimeout(() => {
            oscillator.stop();
        }, 1500);
    } catch (e) {
        console.error("Ses çalma hatası:", e);
    }
}

function playResultSound() {
    if (!soundEnabled) return;
    try {
        const audioContext = createAudioContext();
        if (!audioContext) return;
        
        // Başarı sesi - yukarı sonra aşağı inen ton
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        
        const startTime = audioContext.currentTime;
        oscillator.frequency.setValueAtTime(400, startTime);
        oscillator.frequency.linearRampToValueAtTime(700, startTime + 0.2);
        oscillator.frequency.linearRampToValueAtTime(600, startTime + 0.4);
        
        oscillator.start();
        
        setTimeout(() => {
            oscillator.stop();
        }, 400);
    } catch (e) {
        console.error("Ses çalma hatası:", e);
    }
}

// Socket.io bağlantısı
const socket = io({
    reconnection: true,           // Yeniden bağlanmayı etkinleştir
    reconnectionAttempts: Infinity, // Sonsuz deneme
    reconnectionDelay: 1000,      // İlk deneme için 1 saniye bekle
    reconnectionDelayMax: 5000,   // Maksimum 5 saniye bekleme
    timeout: 20000,              // Bağlantı zaman aşımı
    autoConnect: true            // Otomatik bağlan
});

// Bağlantı durumu için UI elementleri
const connectionStatus = document.createElement('div');
connectionStatus.className = 'connection-status';
connectionStatus.style.display = 'none'; // Başlangıçta gizli
document.body.appendChild(connectionStatus);

// Twemoji'yi kullanarak metindeki emojileri işle
function renderMessageWithEmojis(message) {
    return twemoji.parse(message); // Mesajdaki tüm emojileri Twemoji ile işleme
}

// Sayfa yüklendiğinde URL'den oda parametresini al
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromURL = urlParams.get('room');
    const roleFromURL = urlParams.get('role');
    
    // Eğer URL'de oda parametresi varsa otomatik olarak o odaya bağlan
    if (roomFromURL) {
        let userName = `Kullanıcı${Math.floor(Math.random() * 1000)}`; // Varsayılan kullanıcı adı
        currentRoom = roomFromURL;
        currentUsername = userName;
        
        // URL'den gelen role değerini kontrol et ve geçerliyse kullan
        if (roleFromURL && (roleFromURL === 'developer' || roleFromURL === 'scrumMaster')) {
            currentRole = roleFromURL;
        } else {
            currentRole = 'developer'; // Varsayılan rol
        }
        
        // Önce Scrum Master sayısını kontrol et
        if (currentRole === 'scrumMaster') {
            socket.emit('checkScrumMasterCount', roomFromURL, (count) => {
                if (count >= 2) {
                    // Scrum Master limiti dolu, developer olarak devam et
                    currentRole = 'developer';
                }
                // Kullanıcıyı odaya kaydet
                socket.emit('registerUser', { room: currentRoom, userName, role: currentRole });
                showMainContent();
            });
        } else {
            // Developer rolü için doğrudan katıl
            socket.emit('registerUser', { room: currentRoom, userName, role: currentRole });
            showMainContent();
        }
    }
    
    // Event listeners
    initEventListeners();
});

// Ana içeriği gösterme fonksiyonu (kodun tekrarını önlemek için)
function showMainContent() {
    document.getElementById('nameInput').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.querySelector('.side-panel').style.display = 'flex';
    document.getElementById('cards').style.display = 'block'; // Kartları göster
    roomInfo.textContent = `Oda: ${currentRoom}`;
    userRegistered = true;

    // Rol butonlarını ayarla
    setupRoleButtons();

    const messageElement = document.createElement('p');
    messageElement.className = 'system-message';
    messageElement.innerHTML = `<strong>Sistem:</strong> Şu anki oda: <strong>${currentRoom}</strong>`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Rol butonları işlevselliği
function setupRoleButtons() {
    const developerBtn = document.getElementById('developerButton');
    const scrumMasterBtn = document.getElementById('scrumMasterButton');
    
    // Aktif rolü belirt
    updateRoleButtons();
    
    // Developer butonu tıklama olayı
    developerBtn.addEventListener('click', () => {
        if (currentRole !== 'developer') {
            changeRole('developer');
        }
    });
    
    // Scrum Master butonu tıklama olayı
    scrumMasterBtn.addEventListener('click', () => {
        // Eğer zaten Scrum Master değilse, rol değişikliği iste
        if (currentRole !== 'scrumMaster') {
            // Önce sunucudan Scrum Master sayısını kontrol et
            socket.emit('checkScrumMasterCount', currentRoom, (count) => {
                if (count >= 2) {
                    alert('Bu odada maksimum 2 Scrum Master olabilir!');
                } else {
                    changeRole('scrumMaster');
                }
            });
        }
    });
}

// Rol değiştirme fonksiyonu
function changeRole(newRole) {
    // Sunucuya rol değişikliği bildir
    socket.emit('changeRole', { room: currentRoom, userName: currentUsername, newRole });
}

// Rol butonlarını güncelle
function updateRoleButtons() {
    const developerBtn = document.getElementById('developerButton');
    const scrumMasterBtn = document.getElementById('scrumMasterButton');
    
    // Tüm butonları resetle
    developerBtn.classList.remove('active');
    scrumMasterBtn.classList.remove('active');
    
    // Aktif rolü belirt
    if (currentRole === 'developer') {
        developerBtn.classList.add('active');
    } else if (currentRole === 'scrumMaster') {
        scrumMasterBtn.classList.add('active');
    }
}

// Rol değişikliği olduğunda rol butonlarını güncelle
socket.on('roleUpdated', (role) => {
    currentRole = role;
    updateRoleButtons();
});

// Tüm event listener'ları bir arada başlatan fonksiyon
function initEventListeners() {
    // Rol seçimi için event listeners
    document.querySelectorAll('input[name="role"]').forEach(radio => {
        radio.addEventListener('change', function() {
            currentRole = this.value;
            // Scrum Master seçildi, odaya katılmadan önce uyarı yok
            roleWarning.style.display = 'none';
        });
    });

    // Tab geçişleri için event listeners
    document.querySelectorAll('.tab-header').forEach(tab => {
        tab.addEventListener('click', function() {
            // Aktif tab class'ını değiştir
            document.querySelectorAll('.tab-header').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // İlgili içeriği göster
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Emoji picker işlevselliği
    emojiButton.addEventListener('click', () => {
        emojiPicker.style.display = emojiPicker.style.display === 'block' ? 'none' : 'block';
    });

    // Emoji seçildiğinde
    document.querySelectorAll('.emoji').forEach(emoji => {
        emoji.addEventListener('click', () => {
            chatInput.value += emoji.innerText;
            emojiPicker.style.display = 'none';
        });
    });

    // Sayfa dışına tıklandığında emoji picker'ı kapat
    document.addEventListener('click', (event) => {
        if (!emojiButton.contains(event.target) && !emojiPicker.contains(event.target)) {
            emojiPicker.style.display = 'none';
        }
    });
    
    // Odaya katılma butonu
    joinRoomButton.addEventListener('click', joinRoom);
    
    // Enter tuşu ile odaya katılma
    roomInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            joinRoomButton.click();
        }
    });
    
    // Oy kartları
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', () => voteCard(card));
    });
    
    // Oyları göster butonu
    revealVotesButton.addEventListener('click', revealVotes);
    
    // Oyları temizle butonu
    clearVotesButton.addEventListener('click', clearVotes);
    
    // Kullanıcı adı güncelleme
    updateUsernameButton.addEventListener('click', updateUsername);
    
    // Chat mesajı gönderme
    sendChat.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Ses açma/kapatma
    toggleSoundButton.addEventListener('click', toggleSound);
    
    // Sekme görünürlüğü değiştiğinde
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // İsim değiştirme popup'ı için event listener'lar
    changeNameBtn.addEventListener('click', toggleNamePopup);
    popupClose.addEventListener('click', closeNamePopup);
    namePopup.addEventListener('click', (event) => {
        // Popup dışına tıklandığında kapat
        if (event.target === namePopup) {
            closeNamePopup();
        }
    });
    
    // ESC tuşuna basıldığında popup'ı kapat
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeNamePopup();
        }
    });
}

// Odaya katılma fonksiyonu
function joinRoom() {
    const userName = userNameInput.value.trim();
    const room = roomInput.value.trim();

    if (userName && room) {
        // Seçilen rolü al
        currentRole = document.querySelector('input[name="role"]:checked').value;
        
        // Önce odadaki mevcut Scrum Master sayısını kontrol et
        if (currentRole === 'scrumMaster') {
            socket.emit('checkScrumMasterCount', room, (count) => {
                if (count >= 2) {
                    // Scrum Master limiti dolu, uyarı göster
                    roleWarning.style.display = 'block';
                    // Developer rolünü otomatik seç
                    document.getElementById('roleDeveloper').checked = true;
                    currentRole = 'developer';
                } else {
                    // Limiti aşmıyor, odaya katıl
                    completeJoinRoom(userName, room, currentRole);
                }
            });
        } else {
            // Developer rolü için doğrudan katıl
            completeJoinRoom(userName, room, currentRole);
        }
    } else {
        alert('Lütfen adınızı ve oda adını girin.');
    }
}

// Odaya katılma işlemini tamamla
function completeJoinRoom(userName, room, role) {
    currentRoom = room;
    currentUsername = userName;
    // Role bilgisini de gönder
    socket.emit('registerUser', { room, userName, role });
    
    document.getElementById('nameInput').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.querySelector('.side-panel').style.display = 'flex';
    document.getElementById('cards').style.display = 'block'; // Kartları göster
    roomInfo.textContent = `Oda: ${room}`;
    userRegistered = true;

    const messageElement = document.createElement('p');
    messageElement.className = 'system-message';
    messageElement.innerHTML = `<strong>Sistem:</strong> Şu anki oda: <strong>${room}</strong>`;
    chatMessages.appendChild(messageElement);
}

// Oy kartını seçme fonksiyonu
function voteCard(card) {
    if (!userRegistered) {
        alert('Önce bir odaya katılmalısınız.');
        return;
    }

    const value = card.getAttribute('data-value');
    socket.emit('vote', { room: currentRoom, vote: value });

    // Seçilen kartı vurgula
    document.querySelectorAll('.card').forEach(c => c.classList.remove('selected-card'));
    card.classList.add('selected-card');
    
    // Media query kontrolü ile mobil/masaüstü için farklı transform efekti
    if (window.matchMedia('(max-width: 768px)').matches) {
        // Mobil için transform efekti
        card.style.transform = 'translateY(-5px)';
    } else {
        // Masaüstü için transform efekti
        card.style.transform = 'translateX(8px)';
    }
    
    // Scroll eklendiğinde seçilen kartın görünür olmasını sağla
    if (!window.matchMedia('(max-width: 768px)').matches) {
        // Dikey modda scroll varsa, seçilen kartı görünür kıl
        const cardsPanel = document.getElementById('cards');
        const cardRect = card.getBoundingClientRect();
        const panelRect = cardsPanel.getBoundingClientRect();
        
        // Kart panelin görünür alanı dışındaysa, scroll'u ayarla
        if (cardRect.top < panelRect.top || cardRect.bottom > panelRect.bottom) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// Oyları gösterme fonksiyonu
function revealVotes() {
    if (currentRoom) {
        // Masa elementini al
        const tableElement = document.getElementById('table');
        const chairs = document.querySelectorAll('.chair');
        
        // Eğer zaten dönüyorsa işlem yapma
        if (tableElement.classList.contains('table-spin')) {
            return;
        }
        
        // Döndürme sesi çal
        playSpinSound();
        
        // Spin efektini uygula
        tableElement.classList.add('table-spin');
        
        // Masaya parlama efekti ekle
        tableElement.style.boxShadow = '0 0 30px rgba(67, 97, 238, 0.8)';
        
        // Sandalyelere chair-spin sınıfı ekle
        chairs.forEach(chair => {
            chair.classList.add('chair-spin');
        });
        
        // Animasyon bitiminde oyları göster (1.5 saniye sonra)
        setTimeout(() => {
            // İsteği sunucuya gönder
            socket.emit('revealVotes', currentRoom);
            
            // Parlama efektini kaldır
            tableElement.style.boxShadow = '';
            
            // Spin sınıflarını kaldır
            setTimeout(() => {
                tableElement.classList.remove('table-spin');
                chairs.forEach(chair => {
                    chair.classList.remove('chair-spin');
                });
                
                // Sonuç gösterme sesi çal
                playResultSound();
            }, 500);
        }, 1500);
    }
}

// Oyları temizleme fonksiyonu
function clearVotes() {
    if (currentRoom) {
        socket.emit('clearVotes', currentRoom);

        // UI'ı sıfırla
        document.querySelectorAll('.card').forEach(c => {
            c.classList.remove('selected-card');
            c.style.transform = ''; // Transform efektini temizle
        });
        averageDisplay.innerText = 'Ortalama: Gizli';
        
        // Son oylama panelini temizle
        lastVoteResults.innerHTML = '<p class="no-vote-message">Henüz oylama yapılmadı.</p>';
    }
}

// Kullanıcı adı güncelleme fonksiyonu
function updateUsername() {
    const newUsername = newUsernameInput.value.trim();
    if (newUsername && currentRoom) {
        socket.emit('updateUsername', { 
            room: currentRoom, 
            oldUsername: currentUsername,
            newUsername: newUsername 
        });
        currentUsername = newUsername;
        newUsernameInput.value = '';
        
        const messageElement = document.createElement('p');
        messageElement.className = 'system-message';
        messageElement.innerHTML = `<strong>Sistem:</strong> Kullanıcı adınız <strong>${newUsername}</strong> olarak güncellendi.`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Güncelleme başarılı ise popup'ı kapat
        closeNamePopup();
    }
}

// İsim değiştirme popup'ını açıp kapama
function toggleNamePopup() {
    namePopup.style.display = namePopup.style.display === 'flex' ? 'none' : 'flex';
    if (namePopup.style.display === 'flex') {
        // Popup açıldığında input'a odaklan
        setTimeout(() => {
            newUsernameInput.focus();
        }, 100);
    }
}

// İsim değiştirme popup'ını kapatma
function closeNamePopup() {
    namePopup.style.display = 'none';
}

// Mesaj gönderme fonksiyonu
function sendMessage() {
    const message = chatInput.value.trim();
    if (message && currentRoom) {
        // Sistem komutu kontrolü
        if (message.startsWith('/')) {
            const [command, ...params] = message.slice(1).split(' ');
            if (command === 'help') {
                const helpMessage = `
                    Kullanılabilir komutlar:
                    /makeit backgroundColor red - Arka plan rengini değiştir
                    /makeit textColor blue - Yazı rengini değiştir
                    /makeit fontSize 16px - Yazı boyutunu değiştir
                    /makeit fontFamily Arial - Yazı tipini değiştir
                    /makeit cardColor green - Kart rengini değiştir
                    /makeit tableColor brown - Masa rengini değiştir
                    /makeit chairColor gray - Sandalye rengini değiştir
                    /play [YouTube URL] - YouTube videosu oynat
                    /stop - Video oynatmayı durdur
                    /game [oyun tipi] - Oyun başlat (oyun tipi: agario, snake, tetris)
                    /game mini - Tarayıcı içinde mini Agario oyunu
                    /stopgame - Oyunu durdur
                    /reset - Tüm konfigürasyonları sıfırla
                    /show - Mevcut konfigürasyonları göster
                `;
                const messageElement = document.createElement('p');
                messageElement.className = 'system-message';
                messageElement.innerHTML = helpMessage.replace(/\n/g, '<br>');
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                chatInput.value = '';
                return;
            } else if (command === 'stop') {
                // /stop komutu için sadece sunucuya komut gönder
                // Yerel işlem yapma, sunucu tüm clientlara bildirecek
                socket.emit('chatMessage', { room: currentRoom, message });
                chatInput.value = '';
                return;
            } else if (command === 'stopgame') {
                // /stopgame komutu için sadece sunucuya komut gönder
                socket.emit('chatMessage', { room: currentRoom, message });
                chatInput.value = '';
                return;
            }
        }
        
        socket.emit('chatMessage', { room: currentRoom, message });
        if (soundEnabled) {
            playMessageSentSound();
        }
        chatInput.value = '';
    }
}

// Sekme görünürlüğü değiştiğinde bağlantı kontrolü
function handleVisibilityChange() {
    if (!document.hidden && !socket.connected) {
        console.log('Sekme tekrar aktif, yeniden bağlanılıyor...');
        socket.connect();
    }
}

// Heartbeat gönderme fonksiyonu
function sendHeartbeat() {
    if (document.hidden) {
        // Sekme görünür değilse heartbeat gönder
        socket.emit('heartbeat', { timestamp: Date.now() });
    }
}

// Socket.io event listener'ları
socket.on('userListUpdate', (users) => {
    // Kullanıcı listesi konteyneri
    const container = document.querySelector('.user-list-container');
    container.innerHTML = ''; // Kullanıcı listesini temizle
    table.innerHTML = ''; // Masa temizle
    scrumMasterArea.innerHTML = ''; // Scrum Master alanını temizle
    
    // Developer'ları ve Scrum Master'ları ayır
    const developers = users.filter(user => user.role === 'developer');
    const scrumMasters = users.filter(user => user.role === 'scrumMaster');
    
    // Developer'ları masaya yerleştir
    if (developers.length > 0) {
        const angleStep = (2 * Math.PI) / developers.length;
        developers.forEach((user, index) => {
            const angle = index * angleStep;
            const x = 250 + 200 * Math.cos(angle) - 42.5; // Merkez 250px, yarıçap 200px
            const y = 250 + 200 * Math.sin(angle) - 27.5;

            // Developer'ı masa etrafında göster
            const chair = document.createElement('div');
            chair.className = 'chair';
            chair.style.left = `${x}px`;
            chair.style.top = `${y}px`;
            chair.style.backgroundColor = user.vote !== null ? '#4361ee' : 'white';
            chair.style.color = user.vote !== null ? 'white' : '#212529';
            chair.innerText = user.name.substring(0, 10); // Kullanıcının ilk 10 harfi
            table.appendChild(chair);
        });
    }
    
    // Scrum Master'ları yan panel alanına yerleştir
    scrumMasters.forEach(user => {
        const scrumMasterChair = document.createElement('div');
        scrumMasterChair.className = 'scrum-master-chair';
        scrumMasterChair.style.backgroundColor = user.vote !== null ? '#ff9f1c' : '#f5f5f5';
        scrumMasterChair.style.color = user.vote !== null ? 'white' : '#212529';
        scrumMasterChair.innerText = user.name.substring(0, 10);
        scrumMasterArea.appendChild(scrumMasterChair);
    });
    
    // Tüm kullanıcıları listeye ekle
    users.forEach(user => {
        // Kullanıcı listesini güncelle
        const listItem = document.createElement('p');
        
        // Oy durumuna ve role göre renk ve ikon ekle
        if (user.vote !== null) {
            listItem.innerHTML = `
                <span class="user-vote-status voted">
                    <i class="fas fa-check-circle"></i> Oylandı
                </span>
                <span class="user-name">${user.name}</span>
                <span class="user-role ${user.role}">
                    <i class="fas ${user.role === 'scrumMaster' ? 'fa-user-tie' : 'fa-laptop-code'}"></i>
                    ${user.role === 'scrumMaster' ? 'Scrum Master' : 'Developer'}
                </span>
            `;
        } else {
            listItem.innerHTML = `
                <span class="user-vote-status waiting">
                    <i class="fas fa-clock"></i> Bekleniyor
                </span>
                <span class="user-name">${user.name}</span>
                <span class="user-role ${user.role}">
                    <i class="fas ${user.role === 'scrumMaster' ? 'fa-user-tie' : 'fa-laptop-code'}"></i>
                    ${user.role === 'scrumMaster' ? 'Scrum Master' : 'Developer'}
                </span>
            `;
        }
        
        container.appendChild(listItem);
    });
});

socket.on('updateVotes', ({ votes, average, revealed }) => {
    const table = document.getElementById('table');
    const lastVoteResults = document.getElementById('lastVoteResults');
    const scrumMasterChairs = document.querySelectorAll('.scrumMaster-chair');
    const averageDisplay = document.getElementById('averageDisplay');
    // Tüm sandalyeleri temizle
    for (let i = 0; i < table.children.length; i++) {
        table.children[i].innerText = '';
        table.children[i].style.backgroundColor = '';
        table.children[i].style.color = '';
    }

    // Scrum Master sandalyelerini temizle
    scrumMasterChairs.forEach(chair => {
        chair.innerText = '';
        chair.style.backgroundColor = '';
        chair.style.color = '';
    });

    // Developer ve Scrum Master'ları ayır
    const developers = votes.filter(user => user.role === 'developer');
    const scrumMasters = votes.filter(user => user.role === 'scrumMaster');


    // Developer'ları masaya yerleştir
    developers.forEach((user, index) => {
        if (index < table.children.length) {
            const chair = table.children[index];
            // Kullanıcı adını göster
            chair.innerHTML = `${user.name.substring(0, 10)}<br><span class="user-role developer">Developer</span>`;

            // Eğer oylar görünür hale geldiyse veya kullanıcı oy verdiyse göster
            if (revealed && user.vote !== null) {
                chair.innerHTML = `${user.vote === 0 ? '☕️' : user.vote}<br>${user.name.substring(0, 10)}<br><span class="user-role developer">Developer</span>`;
            } else if (!revealed && user.vote !== null) {
                chair.innerHTML = `🎯<br>${user.name.substring(0, 10)}<br><span class="user-role developer">Developer</span>`;
            }
        }
    });

    // Scrum Master'ları yerleştir
    scrumMasters.forEach((user, index) => {
        if (index < scrumMasterChairs.length) {
            const chair = scrumMasterChairs[index];
            chair.style.backgroundColor = '#ff9f1c';
            chair.style.color = 'white';
            
            // Kullanıcı adını göster
            chair.innerHTML = `${user.name.substring(0, 10)}<br><span class="user-role scrumMaster">Scrum Master</span>`;

            // Eğer oylar görünür hale geldiyse veya kullanıcı oy verdiyse göster
            if (revealed && user.vote !== null) {
                chair.innerHTML = `${user.vote === 0 ? '☕️' : user.vote}<br>${user.name.substring(0, 10)}<br><span class="user-role scrumMaster">Scrum Master</span>`;
            } else if (!revealed && user.vote !== null) {
                chair.innerHTML = `🎯<br>${user.name.substring(0, 10)}<br><span class="user-role scrumMaster">Scrum Master</span>`;
            }
        }
    });

    // Eğer oylar açıklandıysa Son Oylama bölümünü güncelle
    if (revealed) {
        updateLastVotesPanel(votes, average);
    }else {
        
        document.querySelectorAll('.card').forEach(c => {
            c.classList.remove('selected-card');
            c.style.transform = ''; // Transform efektini temizle
        });
    }
});

// Son Oylama panelini güncelleme fonksiyonu
function updateLastVotesPanel(votes, average) {
    const lastVoteResults = document.getElementById('lastVoteResults');
    
    // Son Oylama panelini temizle
    lastVoteResults.innerHTML = '';
    
    // Eğer hiç oy yoksa mesaj göster
    if (votes.length === 0 || votes.every(user => user.vote === null)) {
        lastVoteResults.innerHTML = '<p>Henüz oylama yapılmadı.</p>';
        return;
    }
    
    // Başlık ekle
    const header = document.createElement('h5');
    header.textContent = 'Son Oylama Sonuçları';
    lastVoteResults.appendChild(header);
    
    // Liste oluştur
    const list = document.createElement('ul');
    list.className = 'last-vote-list';
    
    // Developer'ları ve Scrum Master'ları ayrı listele
    const developers = votes.filter(user => user.role === 'developer');
    const scrumMasters = votes.filter(user => user.role === 'scrumMaster');
    
    // Önce Developer'ların oylarını listele
    developers.forEach(user => {
        const item = document.createElement('li');
        
        const userName = document.createElement('span');
        userName.className = 'user-name';
        userName.textContent = user.name;
        
        const userRole = document.createElement('span');
        userRole.className = 'user-role developer';
        userRole.textContent = 'Developer';
        
        const userVote = document.createElement('span');
        userVote.className = 'user-vote';
        
        if (user.vote === null) {
            userVote.textContent = 'Oy vermedi';
        } else if (user.vote === 0) {
            userVote.textContent = '☕️ (Mola istiyor)';
        } else {
            userVote.textContent = user.vote;
        }
        
        item.appendChild(userName);
        item.appendChild(userRole);
        item.appendChild(userVote);
        list.appendChild(item);
    });
    
    // Sonra Scrum Master'ların oylarını listele
    scrumMasters.forEach(user => {
        const item = document.createElement('li');
        
        const userName = document.createElement('span');
        userName.className = 'user-name';
        userName.textContent = user.name;
        
        const userRole = document.createElement('span');
        userRole.className = 'user-role scrumMaster';
        userRole.textContent = 'Scrum Master';
        
        const userVote = document.createElement('span');
        userVote.className = 'user-vote';
        
        if (user.vote === null) {
            userVote.textContent = 'Oy vermedi';
        } else if (user.vote === 0) {
            userVote.textContent = '☕️ (Mola istiyor)';
        } else {
            userVote.textContent = user.vote;
        }
        
        item.appendChild(userName);
        item.appendChild(userRole);
        item.appendChild(userVote);
        list.appendChild(item);
    });
    
    lastVoteResults.appendChild(list);
    
    // Ortalamayı ekle (sadece developer'ların oyları)
    const developerVotes = developers
        .filter(dev => dev.vote !== null && dev.vote !== 0)
        .map(dev => dev.vote);
    
    const averageElement = document.createElement('p');
    averageElement.className = 'average-score';
    
    if (developerVotes.length > 0) {
        const devAverage = Math.round((developerVotes.reduce((sum, vote) => sum + vote, 0) / developerVotes.length) * 10) / 10;
        averageElement.innerHTML = `<strong>Ortalama puan:</strong> ${devAverage}`;

         averageDisplay.innerHTML = `<strong>Ortalama puan:</strong> ${devAverage}`;
    } else {
        averageElement.innerHTML = '<strong>Ortalama puan:</strong> Henüz developer oyu yok';
    }
    
    lastVoteResults.appendChild(averageElement);
}

socket.on('chatMessage', (data) => {
    console.log("Mesaj alındı:", data);
    const messageElement = document.createElement('p');
    const isSystemMessage = data.user === 'System';
    
    if (isSystemMessage) {
        messageElement.classList.add('system-message');
        messageElement.textContent = data.message;
    } else {
        messageElement.innerHTML = `<strong>${data.user}:</strong> ${data.message}`;
        
        // Debug için mevcut kullanıcı adını yazdır
        console.log("Mevcut kullanıcı:", currentUsername);
        console.log("Gönderen kullanıcı:", data.user);
        
        // Kendi mesajım değilse baloncuk göster
        if (data.user && currentUsername && 
            data.user !== currentUsername && 
            data.user !== 'System') {
            console.log("Baloncuk oluşturma koşulu doğru");
            showMessageBubble(data.user, data.message);
            
            // Ses efektleri
            if (soundEnabled) {
                playMessageReceivedSound();
            }
        } else {
            console.log("Bu kendi mesajım veya sistem mesajı, baloncuk gösterilmiyor");
        }
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('connect', () => {
    console.log('Sunucuya bağlandı');
    if (userRegistered) {
        connectionStatus.style.display = 'block';
        connectionStatus.textContent = 'Bağlı';
        connectionStatus.className = 'connection-status connected';
    }
    
    // Eğer daha önce bir odadaysak, yeniden katıl
    if (currentRoom && currentUsername) {
        socket.emit('registerUser', { 
            room: currentRoom, 
            userName: currentUsername,
            role: currentRole 
        });
    }

    if (userRegistered) {
        document.getElementById('cards').style.display = 'block';
    }
});

socket.on('disconnect', () => {
    console.log('Sunucu bağlantısı kesildi');
    if (userRegistered) {
        connectionStatus.style.display = 'block';
        connectionStatus.textContent = 'Bağlantı Kesildi - Yeniden Bağlanıyor...';
        connectionStatus.className = 'connection-status disconnected';
    }
    
    // Kartları gizle ama diğer UI elementlerini koru
    if (userRegistered) {
        document.getElementById('cards').style.display = 'none';
    }
});

socket.on('reconnect', (attemptNumber) => {
    console.log(`${attemptNumber}. denemede yeniden bağlandı`);
    if (userRegistered) {
        connectionStatus.style.display = 'block';
        connectionStatus.textContent = 'Bağlı';
        connectionStatus.className = 'connection-status connected';
    }
    
    // Kartları tekrar göster
    if (userRegistered) {
        document.getElementById('cards').style.display = 'block';
    }
});

socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Yeniden bağlanma denemesi: ${attemptNumber}`);
    if (userRegistered) {
        connectionStatus.style.display = 'block';
        connectionStatus.textContent = `Yeniden Bağlanılıyor... (Deneme: ${attemptNumber})`;
    }
});

socket.on('reconnect_error', (error) => {
    console.log('Yeniden bağlanma hatası:', error);
    if (userRegistered) {
        connectionStatus.style.display = 'block';
        connectionStatus.textContent = 'Bağlantı Hatası';
        connectionStatus.className = 'connection-status error';
    }
});

socket.on('reconnect_failed', () => {
    console.log('Yeniden bağlanma başarısız oldu');
    if (userRegistered) {
        connectionStatus.style.display = 'block';
        connectionStatus.textContent = 'Bağlantı Başarısız - Sayfayı Yenileyin';
        connectionStatus.className = 'connection-status failed';
    }
});

// Düzenli heartbeat gönder
setInterval(sendHeartbeat, 10000);

// Odadan çıkma fonksiyonu (isteğe bağlı - daha sonra kullanmak için)
function leaveRoom() {
    if (currentRoom) {
        socket.emit('leaveRoom', { room: currentRoom, userName: currentUsername });
        currentRoom = null;
        userRegistered = false;
        
        // Ana giriş ekranını göster, diğer bileşenleri gizle
        document.getElementById('nameInput').style.display = 'block';
        document.getElementById('mainContent').style.display = 'none';
        document.querySelector('.side-panel').style.display = 'none';
        document.getElementById('cards').style.display = 'none';
        
        // Oy kartları seçimini temizle
        document.querySelectorAll('.card').forEach(c => {
            c.classList.remove('selected-card');
            c.style.transform = '';
        });
    }
}

// Pencere boyutu değiştiğinde ekranı yeniden ayarla
window.addEventListener('resize', handleScreenSizeChange);

function handleScreenSizeChange() {
    const selectedCard = document.querySelector('.selected-card');
    const cardsElement = document.getElementById('cards');
    
    // Eğer kullanıcı odadaysa ve kartlar görünür olmalıysa
    if (userRegistered && cardsElement.style.display !== 'none') {
        // Mobil görünümde display:flex, desktop görünümde display:block olmalı
        if (window.matchMedia('(max-width: 768px)').matches) {
            cardsElement.style.display = 'flex';
        } else {
            cardsElement.style.display = 'block';
        }
    }
    
    if (selectedCard) {
        if (window.matchMedia('(max-width: 768px)').matches) {
            // Mobil için transform efekti
            selectedCard.style.transform = 'translateY(-5px)';
            
            // Yatay scroll'da kartın görünür olmasını sağla
            setTimeout(() => {
                selectedCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }, 100);
        } else {
            // Masaüstü için transform efekti
            selectedCard.style.transform = 'translateX(8px)';
            
            // Dikey scroll'da kartın görünür olmasını sağla
            setTimeout(() => {
                selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

// Baloncuk mesajı gösterme fonksiyonu
function showMessageBubble(userName, message) {
    console.log("showMessageBubble çağrıldı", userName, message);
    
    // Masa üzerindeki kullanıcıyı bul
    const chairs = document.querySelectorAll('.chair');
    let userChair = null;
    
    // Debug için sandalyelerin içeriğini yazdır
    console.log("Mevcut sandalyeler:");
    chairs.forEach(chair => {
        const chairText = chair.textContent.trim();
        console.log("Sandalye içeriği:", chairText);
        
        // Sandalyedeki metin içinde "-" varsa, sadece kullanıcı adı kısmını al (örn: "5 - Kullanıcı" -> "Kullanıcı")
        let chairUserName = chairText;
        if (chairText.includes('-')) {
            chairUserName = chairText.split('-')[1].trim();
        }
        
        console.log("İşlenmiş sandalye içeriği:", chairUserName);
        
        // Kullanıcı adı karşılaştırması
        if (chairUserName === userName || chairText === userName || chairText.includes(userName)) {
            userChair = chair;
            console.log("Kullanıcı sandalyesi bulundu:", chairText);
        }
    });
    
    if (!userChair) {
        console.log("Kullanıcı sandalyesi bulunamadı! Kullanıcı adı:", userName);
        return; // Kullanıcı masa üzerinde yoksa işlem yapma
    }
    
    // Varsa eski baloncuğu kaldır
    const existingBubble = userChair.querySelector('.chat-bubble');
    if (existingBubble) {
        console.log("Eski baloncuk kaldırılıyor");
        userChair.removeChild(existingBubble);
    }
    
    // Yeni baloncuk oluştur
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    
    // Mesajı kısalt (eğer çok uzunsa)
    const maxLength = 50; // Daha uzun mesajlar gösterilsin
    const displayMessage = message.length > maxLength ? 
        message.substring(0, maxLength) + '...' : message;
    
    // Emoji desteği için twemoji kullan
    bubble.innerHTML = twemoji.parse(displayMessage);
    userChair.appendChild(bubble);
    console.log("Baloncuk eklendi:", displayMessage);
    
    // Animasyon için sınıf ekle
    setTimeout(() => {
        bubble.classList.add('show');
        console.log("Baloncuk show sınıfı eklendi");
        
        // Bir ses çal 
        if (soundEnabled) {
            playMessageReceivedSound();
        }
    }, 10);
    
    // Daha uzun süre görünsün (5 saniye)
    setTimeout(() => {
        if (bubble.parentNode === userChair) {
            bubble.classList.remove('show');
            console.log("Baloncuk gizleme başladı");
            setTimeout(() => {
                if (bubble.parentNode === userChair) {
                    userChair.removeChild(bubble);
                    console.log("Baloncuk kaldırıldı");
                }
            }, 500); // Gizlendikten sonra kaldırma süresi
        }
    }, 5000); // 5 saniye görünsün
}

// YouTube videoyu durdurma fonksiyonu
function stopYoutubeVideo() {
    // Container'ı HTML'den tamamen kaldır
    const container = document.getElementById('youtubeContainer');
    if (container && container.parentNode) {
        container.parentNode.removeChild(container);
    }
    
    // Ayrıca sunucuya komut göndererek herkesin videoyu durdurduğundan emin olalım
    if (currentRoom) {
        socket.emit('chatMessage', { room: currentRoom, message: '/stop' });
    }
}

// Basit Agario benzeri oyun oluşturma
function createAgarioGame() {
    // Eğer hali hazırda varsa kaldır
    const existingGame = document.getElementById('simpleAgarioGame');
    if (existingGame) {
        existingGame.remove();
    }
    
    // Oyun container'ı
    const gameContainer = document.createElement('div');
    gameContainer.id = 'simpleAgarioGame';
    gameContainer.style.position = 'fixed';
    gameContainer.style.top = '50%';
    gameContainer.style.left = '50%';
    gameContainer.style.width = '600px';
    gameContainer.style.height = '400px';
    gameContainer.style.transform = 'translate(-50%, -50%)';
    gameContainer.style.zIndex = '1000';
    gameContainer.style.backgroundColor = '#F8F9FA';
    gameContainer.style.borderRadius = '10px';
    gameContainer.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
    gameContainer.style.overflow = 'hidden';
    gameContainer.style.display = 'flex';
    gameContainer.style.flexDirection = 'column';
    
    // Başlık bar
    const titleBar = document.createElement('div');
    titleBar.style.width = '100%';
    titleBar.style.height = '40px';
    titleBar.style.backgroundColor = '#4361ee';
    titleBar.style.color = 'white';
    titleBar.style.display = 'flex';
    titleBar.style.alignItems = 'center';
    titleBar.style.justifyContent = 'space-between';
    titleBar.style.padding = '0 15px';
    titleBar.style.boxSizing = 'border-box';
    titleBar.style.borderTopLeftRadius = '10px';
    titleBar.style.borderTopRightRadius = '10px';
    gameContainer.appendChild(titleBar);
    
    // Oyun başlığı
    const gameTitle = document.createElement('span');
    gameTitle.textContent = 'Mini Agario';
    gameTitle.style.fontWeight = 'bold';
    gameTitle.style.fontSize = '16px';
    titleBar.appendChild(gameTitle);
    
    // Skorlar
    const scoreDisplay = document.createElement('span');
    scoreDisplay.id = 'gameScore';
    scoreDisplay.textContent = 'Skor: 0';
    scoreDisplay.style.fontSize = '14px';
    titleBar.appendChild(scoreDisplay);
    
    // Kapatma butonu
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.width = '24px';
    closeButton.style.height = '24px';
    closeButton.style.borderRadius = '50%';
    closeButton.style.border = 'none';
    closeButton.style.backgroundColor = 'rgba(255,255,255,0.3)';
    closeButton.style.color = 'white';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '18px';
    closeButton.style.lineHeight = '1';
    closeButton.style.padding = '0';
    closeButton.style.marginLeft = '15px';
    closeButton.style.display = 'flex';
    closeButton.style.alignItems = 'center';
    closeButton.style.justifyContent = 'center';
    closeButton.onclick = function() {
        // Oyunu kapat - güvenilir şekilde
        const gameEl = document.getElementById('simpleAgarioGame');
        if (gameEl) {
            try {
                gameEl.remove();
            } catch (e) {
                if (gameEl.parentNode) {
                    gameEl.parentNode.removeChild(gameEl);
                } else {
                    gameEl.style.display = 'none';
                }
            }
        }
        
        // Ayrıca serverda stopgame komutunu çalıştır
        if (currentRoom) {
            socket.emit('chatMessage', { room: currentRoom, message: '/stopgame' });
        }
    };
    titleBar.appendChild(closeButton);
    
    // Oyun alanı
    const gameCanvas = document.createElement('canvas');
    gameCanvas.id = 'gameCanvas';
    gameCanvas.width = 600;
    gameCanvas.height = 360;
    gameCanvas.style.backgroundColor = 'white';
    gameContainer.appendChild(gameCanvas);
    
    document.body.appendChild(gameContainer);
    
    // Oyun kodu
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let score = 0;
    
    // Oyuncu
    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 20,
        color: '#4361ee',
        dx: 0,
        dy: 0,
        speed: 3
    };
    
    // Hedefler
    let targets = [];
    
    // Hedef oluştur
    function createTarget() {
        const radius = Math.random() * 10 + 5;
        const target = {
            x: Math.random() * (canvas.width - radius * 2) + radius,
            y: Math.random() * (canvas.height - radius * 2) + radius,
            radius: radius,
            color: getRandomColor()
        };
        targets.push(target);
    }
    
    // Rastgele renk
    function getRandomColor() {
        const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FF3399'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // İlk hedefleri oluştur
    for (let i = 0; i < 10; i++) {
        createTarget();
    }
    
    // Oyun döngüsü
    function gameLoop() {
        // Ekranı temizle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Hedefleri çiz
        targets.forEach(target => {
            ctx.beginPath();
            ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
            ctx.fillStyle = target.color;
            ctx.fill();
            ctx.closePath();
        });
        
        // Oyuncuyu hareket ettir
        player.x += player.dx;
        player.y += player.dy;
        
        // Sınırlar içinde tut
        if (player.x < player.radius) {
            player.x = player.radius;
        }
        if (player.x > canvas.width - player.radius) {
            player.x = canvas.width - player.radius;
        }
        if (player.y < player.radius) {
            player.y = player.radius;
        }
        if (player.y > canvas.height - player.radius) {
            player.y = canvas.height - player.radius;
        }
        
        // Oyuncuyu çiz
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fillStyle = player.color;
        ctx.fill();
        ctx.closePath();
        
        // Çarpışma kontrolü
        targets = targets.filter(target => {
            const dx = player.x - target.x;
            const dy = player.y - target.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < player.radius + target.radius && player.radius > target.radius) {
                // Oyuncu büyüsün
                player.radius += target.radius / 10;
                // Skor artsın
                score += Math.floor(target.radius);
                document.getElementById('gameScore').textContent = 'Skor: ' + score;
                // Yeni hedef oluştur
                createTarget();
                return false;
            } else if (distance < player.radius + target.radius && player.radius < target.radius) {
                // Oyun bitti
                alert('Oyun Bitti! Skorunuz: ' + score);
                gameContainer.remove();
                return false;
            }
            return true;
        });
        
        // Devam et
        if (document.getElementById('simpleAgarioGame')) {
            requestAnimationFrame(gameLoop);
        }
    }
    
    // Fare kontrolü
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Oyuncuyu fareye doğru hareket ettir
        const dx = mouseX - player.x;
        const dy = mouseY - player.y;
        const angle = Math.atan2(dy, dx);
        
        player.dx = Math.cos(angle) * player.speed;
        player.dy = Math.sin(angle) * player.speed;
    });
    
    // Oyunu başlat
    gameLoop();
}

// Konfigürasyon değişikliklerini dinle
socket.on('configUpdate', ({ room, configs }) => {
    if (room === currentRoom) {
        // Konfigürasyonları uygula
        console.log('configUpdate çağrıldı', configs);
        Object.entries(configs).forEach(([property, value]) => {
            switch(property) {
                case 'backgroundColor':
                    document.body.style.backgroundColor = value;
                    break;
                case 'textColor':
                    document.body.style.color = value;
                    break;
                case 'fontSize':
                    document.body.style.fontSize = value;
                    break;
                case 'fontFamily':
                    document.body.style.fontFamily = value;
                    break;
                case 'cardColor':
                    document.querySelectorAll('.card').forEach(card => {
                        card.style.backgroundColor = value;
                        if (!card.classList.contains('selected-card')) {
                            card.style.borderColor = value;
                        }
                    });
                    break;
                case 'tableColor':
                    const table = document.getElementById('table');
                    table.style.backgroundColor = value;
                    break;
                case 'chairColor':
                    document.querySelectorAll('.chair').forEach(chair => {
                        chair.style.backgroundColor = value;
                        if (!chair.classList.contains('selected-chair')) {
                            chair.style.borderColor = value;
                        }
                    });
                    break;
                case 'youtubeVideo':
                    console.log('YouTube video değeri:', value);
                    if (value !== "stop") {
                        // Eğer container yoksa oluştur
                        let youtubeContainer = document.getElementById('youtubeContainer');
                        if (!youtubeContainer) {
                            youtubeContainer = document.createElement('div');
                            youtubeContainer.id = 'youtubeContainer';
                            youtubeContainer.style.position = 'fixed';
                            youtubeContainer.style.top = '20px';
                            youtubeContainer.style.right = '20px';
                            youtubeContainer.style.width = '320px';
                            youtubeContainer.style.height = '180px';
                            youtubeContainer.style.zIndex = '1000';
                            youtubeContainer.style.backgroundColor = 'white';
                            youtubeContainer.style.borderRadius = '8px';
                            youtubeContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
                            youtubeContainer.style.overflow = 'hidden';
                            
                            // Kapatma butonu ekle
                            const closeButton = document.createElement('button');
                            closeButton.innerHTML = '×';
                            closeButton.style.position = 'absolute';
                            closeButton.style.right = '5px';
                            closeButton.style.top = '5px';
                            closeButton.style.width = '24px';
                            closeButton.style.height = '24px';
                            closeButton.style.borderRadius = '50%';
                            closeButton.style.border = 'none';
                            closeButton.style.backgroundColor = 'rgba(0,0,0,0.5)';
                            closeButton.style.color = 'white';
                            closeButton.style.cursor = 'pointer';
                            closeButton.style.fontSize = '16px';
                            closeButton.style.lineHeight = '1';
                            closeButton.style.padding = '0';
                            closeButton.onclick = function() {
                                // Önce komutu gönder, sonra yerel işlem yap
                                stopYoutubeVideo();
                            };
                            youtubeContainer.appendChild(closeButton);
                            
                            // iframe container'ı
                            const iframeContainer = document.createElement('div');
                            iframeContainer.style.width = '100%';
                            iframeContainer.style.height = '100%';
                            youtubeContainer.appendChild(iframeContainer);
                            
                            document.body.appendChild(youtubeContainer);
                        }
                        
                        // YouTube videosunu oynat
                        const iframeContainer = youtubeContainer.querySelector('div');
                        const iframe = document.createElement('iframe');
                        iframe.width = '100%';
                        iframe.height = '100%';
                        iframe.src = `https://www.youtube.com/embed/${value}?autoplay=1`;
                        iframe.frameBorder = '0';
                        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                        iframe.allowFullscreen = true;
                        
                        // Eski iframe'i temizle
                        iframeContainer.innerHTML = '';
                        iframeContainer.appendChild(iframe);
                    } else {
                        console.log('Video durdurma komutu alındı, stopYoutubeVideo() çağrılıyor');
                        // Video oynatmayı durdur - DOM'dan kaldır
                        const youtubeContainer = document.getElementById('youtubeContainer');
                        if (youtubeContainer) {
                            console.log('YouTube container bulundu, kaldırılıyor');
                            document.body.removeChild(youtubeContainer);
                        } else {
                            console.log('YouTube container bulunamadı');
                        }
                    }
                    break;
                case 'gameFrame':
                    if (value) {
                        // Eğer container yoksa oluştur
                        let gameContainer = document.getElementById('gameContainer');
                        if (!gameContainer) {
                            gameContainer = document.createElement('div');
                            gameContainer.id = 'gameContainer';
                            gameContainer.style.position = 'fixed';
                            gameContainer.style.top = '50%';
                            gameContainer.style.left = '50%';
                            gameContainer.style.width = '800px';
                            gameContainer.style.height = '600px';
                            gameContainer.style.transform = 'translate(-50%, -50%)';
                            gameContainer.style.zIndex = '1000';
                            gameContainer.style.backgroundColor = 'white';
                            gameContainer.style.borderRadius = '10px';
                            gameContainer.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
                            gameContainer.style.overflow = 'hidden';
                            
                            // Başlık bar
                            const titleBar = document.createElement('div');
                            titleBar.style.width = '100%';
                            titleBar.style.height = '40px';
                            titleBar.style.backgroundColor = '#4361ee';
                            titleBar.style.color = 'white';
                            titleBar.style.display = 'flex';
                            titleBar.style.alignItems = 'center';
                            titleBar.style.justifyContent = 'space-between';
                            titleBar.style.padding = '0 15px';
                            titleBar.style.boxSizing = 'border-box';
                            titleBar.style.borderTopLeftRadius = '10px';
                            titleBar.style.borderTopRightRadius = '10px';
                            gameContainer.appendChild(titleBar);
                            
                            // Oyun başlığı
                            const gameTitle = document.createElement('span');
                            gameTitle.id = 'gameTitle';
                            gameTitle.style.fontWeight = 'bold';
                            gameTitle.style.fontSize = '16px';
                            titleBar.appendChild(gameTitle);
                            
                            // Kapatma butonu
                            const closeButton = document.createElement('button');
                            closeButton.innerHTML = '×';
                            closeButton.style.width = '24px';
                            closeButton.style.height = '24px';
                            closeButton.style.borderRadius = '50%';
                            closeButton.style.border = 'none';
                            closeButton.style.backgroundColor = 'rgba(255,255,255,0.3)';
                            closeButton.style.color = 'white';
                            closeButton.style.cursor = 'pointer';
                            closeButton.style.fontSize = '18px';
                            closeButton.style.lineHeight = '1';
                            closeButton.style.padding = '0';
                            closeButton.style.display = 'flex';
                            closeButton.style.alignItems = 'center';
                            closeButton.style.justifyContent = 'center';
                            closeButton.onclick = function() {
                                // Kapatma komutu gönder
                                if (currentRoom) {
                                    socket.emit('chatMessage', { room: currentRoom, message: '/stopgame' });
                                }
                            };
                            titleBar.appendChild(closeButton);
                            
                            // iframe için div container
                            const iframeContainer = document.createElement('div');
                            iframeContainer.id = 'gameIframeContainer';
                            iframeContainer.style.width = '100%';
                            iframeContainer.style.height = 'calc(100% - 40px)';
                            gameContainer.appendChild(iframeContainer);
                            
                            document.body.appendChild(gameContainer);
                        }
                        
                        // Oyun başlığını güncelle
                        const gameTitle = document.getElementById('gameTitle');
                        if (gameTitle) {
                            gameTitle.textContent = value.name || 'Oyun';
                        }
                        
                        // Oyun iframe'ini ekle
                        const iframeContainer = document.getElementById('gameIframeContainer');
                        if (iframeContainer) {
                            const iframe = document.createElement('iframe');
                            iframe.width = '100%';
                            iframe.height = '100%';
                            iframe.src = value.url;
                            iframe.frameBorder = '0';
                            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                            iframe.allowFullscreen = true;
                            
                            // Mevcut içeriği temizle
                            iframeContainer.innerHTML = '';
                            iframeContainer.appendChild(iframe);
                        }
                    } else {
                        // Oyun container'ını kaldır - daha güvenilir yöntem
                        const container = document.getElementById('gameContainer');
                        if (container) {
                            // İlk yöntem: remove() kullan
                            try {
                                container.remove();
                            } catch (e) {
                                // İkinci yöntem: parentNode.removeChild() kullan
                                if (container.parentNode) {
                                    container.parentNode.removeChild(container);
                                } else {
                                    // Son çare: display:none ile gizle
                                    container.style.display = 'none';
                                }
                            }
                            
                            // Ek önlem olarak oyun iframe içeriğini temizle
                            const iframeContainer = document.getElementById('gameIframeContainer');
                            if (iframeContainer) {
                                iframeContainer.innerHTML = '';
                            }
                        }
                    }
                    break;
                case 'miniGame':
                    if (value === 'agario') {
                        // Mini Agario oyununu başlat
                        createAgarioGame();
                    } else {
                        // Diğer mini oyunlar eklenebilir
                    }
                    break;
            }
        });
    }
});

