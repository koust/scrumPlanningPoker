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

// Global değişkenler
let currentRoom = null;
let currentUsername = null;
let userRegistered = false;
let soundEnabled = true;

// Ses efektleri
const messageSentSound = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_c518b4a13d.mp3?filename=message-sent-126008.mp3');
const messageReceivedSound = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_47fee2df36.mp3?filename=notification-sound-127856.mp3');
messageSentSound.volume = 0.3;
messageReceivedSound.volume = 0.3;

// Socket.io bağlantısı
const socket = io({
    reconnection: true,           // Yeniden bağlanmayı etkinleştir
    reconnectionAttempts: 10,     // Maksimum yeniden bağlanma denemesi
    reconnectionDelay: 2000,      // Yeniden bağlanma denemeleri arasındaki bekleme süresi (ms)
});

// Twemoji'yi kullanarak metindeki emojileri işle
function renderMessageWithEmojis(message) {
    return twemoji.parse(message); // Mesajdaki tüm emojileri Twemoji ile işleme
}

// Sayfa yüklendiğinde URL'den oda parametresini al
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromURL = urlParams.get('room');
    
    // Eğer URL'de oda parametresi varsa otomatik olarak o odaya bağlan
    if (roomFromURL) {
        let userName = `Kullanıcı${Math.floor(Math.random() * 1000)}`; // Varsayılan kullanıcı adı
        currentRoom = roomFromURL;
        currentUsername = userName;
        socket.emit('registerUser', { room: currentRoom, userName }); // Kullanıcıyı odaya kaydet

        document.getElementById('nameInput').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        document.querySelector('.side-panel').style.display = 'flex';
        document.getElementById('cards').style.display = 'block'; // Kartları göster
        roomInfo.textContent = `Oda: ${currentRoom}`;
        userRegistered = true;

        const messageElement = document.createElement('p');
        messageElement.className = 'system-message';
        messageElement.innerHTML = `<strong>Sistem:</strong> Şu anki oda: <strong>${currentRoom}</strong>`;
        chatMessages.appendChild(messageElement);
    }
    
    // Event listeners
    initEventListeners();
});

// Tüm event listener'ları bir arada başlatan fonksiyon
function initEventListeners() {
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
        currentRoom = room;
        currentUsername = userName;
        socket.emit('registerUser', { room, userName });
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
    } else {
        alert('Lütfen adınızı ve oda adını girin.');
    }
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
        socket.emit('revealVotes', currentRoom);
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
        socket.emit('chatMessage', { room: currentRoom, message });
        if (soundEnabled) {
            messageSentSound.play();
        }
        chatInput.value = '';
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
    userList.innerHTML = '<h3>Odadaki Kullanıcılar:</h3>';
    table.innerHTML = '';

    const angleStep = (2 * Math.PI) / users.length;
    users.forEach((user, index) => {
        const angle = index * angleStep;
        const x = 250 + 200 * Math.cos(angle) - 42.5; // Merkez 250px, yarıçap 200px
        const y = 250 + 200 * Math.sin(angle) - 27.5;

        // Kullanıcıyı masa etrafında göster
        const chair = document.createElement('div');
        chair.className = 'chair';
        chair.style.left = `${x}px`;
        chair.style.top = `${y}px`;
        chair.style.backgroundColor = user.vote !== null ? '#4361ee' : 'white';
        chair.style.color = user.vote !== null ? 'white' : '#212529';
        chair.innerText = user.name.substring(0, 10); // Kullanıcının ilk 10 harfi
        table.appendChild(chair);

        // Kullanıcı listesini güncelle
        const listItem = document.createElement('p');
        listItem.innerText = `${user.name} ${user.vote !== null ? '(Oylandı)' : '(Oylanmadı)'}`;
        userList.appendChild(listItem);
    });
});

socket.on('updateVotes', ({ votes, average, revealed }) => {
    if (revealed) {
        averageDisplay.innerText = `Ortalama: ${average}`;
        votes.forEach((user, index) => {
            const chair = table.children[index];
            if(user.vote !== null) {
                if (user.vote === 0) {
                    if (chair) chair.innerText = `☕️ - ${user.name.substring(0, 10)}`;
                } else {
                    if (chair) chair.innerText = `${user.vote} - ${user.name.substring(0, 10)}`;
                }
            }
        });
    } else {
        document.querySelectorAll('.card').forEach(c => {
            c.classList.remove('selected-card');
            c.style.transform = ''; // Transform efektini temizle
        });
        averageDisplay.innerText = 'Ortalama: Gizli';
        Array.from(table.children).forEach(chair => {
            chair.innerText = chair.innerText.split('-')[0]; // Sadece ismi göster
        });
    }
});

socket.on('chatMessage', ({ user, message }) => {
    if (soundEnabled) {
        if(user != currentUsername){
            messageReceivedSound.play();
        }
    }
    const messageElement = document.createElement('p');
    messageElement.innerHTML = `<strong>${user}:</strong> ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('disconnect', () => {
    console.log('Sunucu bağlantısı kesildi.');
    // Kullanıcı bağlantı kesildiğinde odadan çıkmış olur, kartları gizle
    document.getElementById('cards').style.display = 'none';
    alert('Bağlantı kesildi. Yeniden bağlanmaya çalışılıyor...');
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

