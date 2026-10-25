const WebSocket = require('ws');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("Enter your desired username: ", (chosenName) => {
    const username = chosenName.trim() || "Anonymous";
    const ws = new WebSocket('ws://localhost:8080');

    ws.on('open', () => {
        console.log(`\n[SYSTEM] Logged onto server pool as: ${username}`);
        console.log("Commands available: /list, /shrug, /whisper [user] [msg]");
        console.log("-------------------------------------------------------");
        
        ws.send(JSON.stringify({ type: "join", name: username }));
        promptUser(username, ws);
    });

    ws.on('message', (data) => {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        
        console.log(data.toString());
        promptUser(username, ws); 
    });

    ws.on('close', () => {
        console.log("\n[SYSTEM] Disconnected from server hub.");
        process.exit();
    });
});

function promptUser(username, ws) {
    rl.question(`${username} > `, (input) => {
        const text = input.trim();
        if (text !== '') {
            ws.send(JSON.stringify({ type: "chat", message: text }));
            
            // Only print your own output locally if it ISN'T a server text shortcut command
            if (!text.startsWith('/')) {
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);
                console.log(`[${username}]: ${text}`);
            }
        }
        promptUser(username, ws);
    });
}
