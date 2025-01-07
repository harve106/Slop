// Global variables
let currentUsername = '';
let updateInterval = null;
let currentChatFile = null;
let chatUpdateInterval = null;

function isValidUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

async function loadChatContent(chatFile) {
   try {
       const response = await fetch(`/messages/${chatFile}`);
       if (!response.ok) throw new Error('Failed to fetch chat content');
       const html = await response.text();
       
       // Extract body content
       const parser = new DOMParser();
       const doc = parser.parseFromString(html, 'text/html');
       const styleContent = doc.head.getElementsByTagName('style')[0].outerHTML;
       const bodyContent = styleContent + doc.body.innerHTML;
       
       // Update display
       const chatDisplay = document.getElementById('chatDisplay');
       chatDisplay.innerHTML = bodyContent;
       chatDisplay.style.display = 'block';
       
       // Scroll to bottom
       chatDisplay.scrollTop = chatDisplay.scrollHeight;
   } catch (error) {
       console.error('Error loading chat:', error);
   }
}

function startChatUpdates(chatFile) {
    if (chatUpdateInterval) {
        clearInterval(chatUpdateInterval);
    }
    chatUpdateInterval = setInterval(() => loadChatContent(chatFile), 1000);
}

async function updateChatList() {
    if (!currentUsername) return;
    
    try {
        const response = await fetch('/messages/');
        if (!response.ok) throw new Error('Failed to fetch directory listing');
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const chatFiles = Array.from(doc.querySelectorAll('a'))
            .map(a => a.href.split('/').pop())
            .filter(filename => filename && filename.endsWith('.html'))
            .filter(filename => filename.includes(currentUsername));
        
        const chatList = document.getElementById('chatList');
        chatList.innerHTML = '';
        
        chatFiles.forEach(chat => {
            const li = document.createElement('li');
            li.className = 'chat-item';
            
            const participants = chat.replace('.html', '')
                                   .split('_')
                                   .filter(name => name !== currentUsername)
                                   .join(', ');
            
            li.textContent = participants || 'Private Notes';
            
            li.onclick = () => {
                currentChatFile = chat;
                loadChatContent(chat);
                startChatUpdates(chat);
                
                // Update recipients field
                const recipientsList = chat.replace('.html', '')
                                         .split('_')
                                         .filter(name => name !== currentUsername);
                document.getElementById('recipients').value = recipientsList.join(', ');
            };
            
            chatList.appendChild(li);
        });
    } catch (error) {
        console.error('Error updating chat list:', error);
    }
}

document.getElementById('setUsername').addEventListener('click', function() {
    const usernameInput = document.getElementById('username');
    const username = usernameInput.value.trim();
    
    document.getElementById('usernameError').style.display = 'none';
    
    if (!isValidUsername(username)) {
        showError('usernameError', 'Username must be 3-20 characters and contain only letters, numbers, and underscores');
        return;
    }
    
    currentUsername = username;
    document.getElementById('sidebar').style.display = 'block';
    document.getElementById('messageForm').style.display = 'block';
    
    usernameInput.disabled = true;
    this.disabled = true;
    
    updateChatList();
    updateInterval = setInterval(updateChatList, 1000);
});

document.getElementById('messageForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    document.querySelectorAll('.error').forEach(el => el.style.display = 'none');
    document.getElementById('successMessage').style.display = 'none';
    
    const message = document.getElementById('message').value.trim();
    const recipients = document.getElementById('recipients').value.trim();
    
    let isValid = true;
    
    if (!message) {
        showError('messageError', 'Message is required');
        isValid = false;
    } else if (message.length > 1000) {
        showError('messageError', 'Message must be less than 1000 characters');
        isValid = false;
    }
    
    if (!recipients) {
        showError('recipientsError', 'Recipients are required');
        isValid = false;
    } else {
        const recipientList = recipients.split(',').map(r => r.trim());
        if (recipientList.some(r => !isValidUsername(r))) {
            showError('recipientsError', 'Invalid username format in recipients list');
            isValid = false;
        }
    }
    
    if (!isValid) return;
    
    const recipientList = recipients.split(',').map(r => r.trim()).sort();
    const groupName = [currentUsername, ...recipientList].sort().join('_');
    
    try {
        const response = await fetch('/api/v1/sendMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: currentUsername,
                message: message,
                group: groupName
            })
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        document.getElementById('successMessage').style.display = 'block';
        document.getElementById('message').value = '';
        
        updateChatList();
    } catch (error) {
        showError('messageError', 'Failed to send message. Please try again.');
        console.error('Error:', error);
    }
});

window.addEventListener('unload', function() {
    if (updateInterval) clearInterval(updateInterval);
    if (chatUpdateInterval) clearInterval(chatUpdateInterval);
});