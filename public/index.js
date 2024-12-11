// const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendChat');
const messages = document.getElementById('messages');


const messageSentSound = new Audio('/sounds/message-sent.wav');
const messageReceivedSound = new Audio('/sounds/message-received.wav');
// Twemoji'yi kullanarak metindeki emojileri işle
function renderMessageWithEmojis(message) {
    return twemoji.parse(message); // Mesajdaki tüm emojileri Twemoji ile işleme
}

// Mesajı chat'e ekle
function addMessageToChat(user, message) {
    const messageElement = document.createElement('div');
    messageElement.innerHTML = `<strong>${user}:</strong> ${renderMessageWithEmojis(message)}`;
    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight; // Scroll otomatik alta kayar
}


const emojiButton = document.getElementById('emojiButton');
const emojiPicker = document.getElementById('emojiPicker');

// Emoji picker'ı aç/kapat
emojiButton.addEventListener('click', () => {
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
});

// Emoji seçildiğinde chat girişine ekle
emojiPicker.addEventListener('click', (event) => {
    if (event.target.classList.contains('emoji')) {
        chatInput.value += event.target.textContent; // Seçilen emojiyi girişe ekle
        emojiPicker.style.display = 'none'; // Emoji picker'ı kapat
    }
});



// Mesaj gönderme
sendButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
        // const messageElement = document.createElement('p');
        // messageElement.textContent = message;
        // messages.appendChild(messageElement);
        sendMessage()
    }
});


const updateUsernameButton = document.getElementById('updateUsernameButton');

// Kullanıcı adını güncelleme
updateUsernameButton.addEventListener('click', () => {
    const newUsername = newUsernameInput.value.trim();
    if (newUsername && currentRoom) {
        socket.emit('updateUsername', { room: currentRoom, newUsername });
        userName = newUsername; // Yeni kullanıcı adını sakla
        newUsernameInput.value = ''; // Giriş alanını temizle
    }
});

