const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

// Change this line at the top of server.js
const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: port });

console.log(`[STATUS] Server is running on port ${port}`);

const clients = new Map(); // Tracks socket -> username
const LOG_FILE = path.join(__dirname, 'chat.log');

console.log("[STATUS] Advanced Chat Server running on ws://localhost:8080");
logToFile("[SYSTEM] --- Server Session Started ---");

wss.on('connection', (ws) => {
    ws.on('message', (rawData) => {
        try {
            const data = JSON.parse(rawData.toString());
            const senderName = clients.get(ws) || "Unknown";

            // 1. ARRIVAL LOGIC
            if (data.type === "join") {
                clients.set(ws, data.name);
                const joinMsg = `[SYSTEM] ${data.name} has entered the room.`;
                console.log(`[SERVER] ${data.name} connected.`);
                broadcast(joinMsg, ws);
                logToFile(joinMsg);
            }

            // 2. CHAT & COMMAND LOGIC
            if (data.type === "chat") {
                const text = data.message.trim();

                // COMMAND PARSER: Checks if text starts with '/'
                if (text.startsWith('/')) {
                    handleCommand(ws, senderName, text);
                } else {
                    // Standard message routing
                    const completePayload = `[${senderName}]: ${text}`;
                    broadcast(completePayload, ws);
                    logToFile(completePayload);
                }
            }
        } catch (err) {
            console.error("Received malformed transmission frame.");
        }
    });

    ws.on('close', () => {
        const leavingUser = clients.get(ws);
        if (leavingUser) {
            clients.delete(ws);
            const leaveMsg = `[SYSTEM] ${leavingUser} has left the room.`;
            console.log(`[SERVER] ${leavingUser} disconnected.`);
            broadcast(leaveMsg);
            logToFile(leaveMsg);
        }
    });
});

// INTERNALS: Command Handler
function handleCommand(ws, senderName, text) {
    const args = text.split(' ');
    const command = args[0].toLowerCase();

    switch (command) {
        case '/list':
            // Compile list of online names
            const onlineUsers = Array.from(clients.values()).join(', ');
            ws.send(`[SERVER-INFO] Active Users: ${onlineUsers}`);
            break;

        case '/shrug':
            // Automatically append text emoji expression
            const shrugPayload = `[${senderName}]: ¯\\_(ツ)_/¯`;
            broadcast(shrugPayload, ws);
            ws.send(shrugPayload); // Echo back to sender
            logToFile(shrugPayload);
            break;

        case '/whisper':
            // Private messaging configuration: /whisper [targetName] [message]
            if (args.length < 3) {
                ws.send("[SERVER-ERROR] Usage: /whisper [username] [your message]");
                return;
            }
            const targetName = args[1];
            const privateMsg = args.slice(2).join(' ');
            
            let targetSocket = null;
            for (let [s, name] of clients.entries()) {
                if (name === targetName) { targetSocket = s; break; }
            }

            if (targetSocket && targetSocket.readyState === ws.OPEN) {
                targetSocket.send(`[WHISPER from ${senderName}]: ${privateMsg}`);
                ws.send(`[WHISPER to ${targetName}]: ${privateMsg}`);
            } else {
                ws.send(`[SERVER-ERROR] User "${targetName}" is not active or found.`);
            }
            break;

        default:
            ws.send(`[SERVER-ERROR] Unknown command: ${command}`);
            break;
    }
}

// INTERNALS: Message Broadcasting
function broadcast(textString, excludeSocket) {
    for (let [clientSocket, name] of clients.entries()) {
        if (clientSocket !== excludeSocket && clientSocket.readyState === clientSocket.OPEN) {
            clientSocket.send(textString);
        }
    }
}

// INTERNALS: Persistent File Logger
function logToFile(text) {
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const logLine = `[${timestamp}] ${text}\n`;
    
    // Asynchronously appends text lines into chat.log
    fs.appendFile(LOG_FILE, logLine, (err) => {
        if (err) console.error("Failed writing network frames to storage: ", err);
    });
}
