const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const {CreateServerBind, GetServerBind, RemoveServerBind} = require("./server_bind");

const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('New connection');

    // 处理身份验证
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            handleSignalingData(ws, data);

        } catch (error) {
            // 转换 message 为字符串
            console.error(error);
            // 处理错误
            ws.send(JSON.stringify({ type: 'error', payload: 'Invalid JSON received'}));
        }
    });

    ws.on('error', (err) => {
        console.error(err);
    });

    // 处理关闭连接
    ws.on('close', () => {
        console.log('Connection closed');
        RemoveServerBind(ws.channelId);
    });
});

// 处理信令数据
function handleSignalingData(ws, data) {
    // 通道id(从服务端peer获得)
    const channelId = data.channel_id;
    // 绑定通道id
    ws.channelId = channelId;
    // role
    const role = data.role;
    // type
    const type = data.type;

    console.log('Received signaling type:', type)

    switch (type) {
        case 'create':{
            CreateServerBind(channelId, ws, role);
            ws.send(JSON.stringify({ channel_id: channelId, role: "", type: 'created', payload: 'Room created' }));
            break;
        }
        case 'join':{
            const s = GetServerBind(channelId)
            if (!s) {
                ws.send(JSON.stringify({ channel_id: channelId, role: "", type: 'error', payload: 'Room not found' }));
            }
            if( role === 'server' ){
                s.setServer(ws);
            } else {
                s.setClient(ws);
            }
            break;
        }
        case 'offer':{
            // 转发 offer
            const s = GetServerBind(channelId)
            if(!s){
                ws.send(JSON.stringify({ channel_id: channelId, role: "", type: 'error', payload: 'Room not found'}));
            }
            // 发送offer到接收端(服务器)
            const svr = role === "server" ? s.client : s.server;
            svr.send(JSON.stringify({ channel_id: channelId, role, type: 'offer', payload: data.payload }));
            break
        }
        case 'answer':{
            // 转发 answer
            const s = GetServerBind(channelId)
            if(!s){
                ws.send(JSON.stringify({ channel_id: channelId, role: "", type: 'error', payload: 'Room not found' }));
            }
            // 发送answer到发送端(客户端)
            const svr = role === "server" ? s.client : s.server;
            svr.send(JSON.stringify({ channel_id: channelId, role: role, type: 'answer', payload: data.payload }));
            break
        }
        case 'candidate': {
            // 转发 candidate
            const s = GetServerBind(channelId)
            if (!s) {
                ws.send(JSON.stringify({channel_id: channelId, role: "", type: 'error', payload: 'Room not found'}));
            }
            const svr = role === "server" ? s.client : s.server;
            svr.send(JSON.stringify({
                channel_id: channelId,
                role: role,
                type: 'candidate',
                payload: data.payload
            }));
            break
        }
        default:
            console.warn('Unknown message type:', type);
    }
}

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// server 增加 static 支持
