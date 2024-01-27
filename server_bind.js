// 负责 发送端 与 接收端 之间的绑定
class ServerBind {
    constructor(id) {
        this.id = id
        this.client = null; // 发送端
        this.server = null; // 接收端
    }

    // 绑定 接收端
    setServer(server) {
        this.server = server;
    }

    // 绑定 发送端
    setClient(client) {
        this.client = client;
    }
}

const serverBinds = new Map();
function GetServerBind(id) {
    return serverBinds.get(id);
}

function CreateServerBind(id, ws, role) {
    const serverBind = new ServerBind(id);
    if( role === 'server' ){
        serverBind.setServer(ws);
    } else {
        serverBind.setClient(ws);
    }
    serverBinds.set(id, serverBind);
    return serverBind;
}

function RemoveServerBind(id) {
    const s = GetServerBind(id);
    if(s){
        if(!s.client){
            debugger
        }
        if(!s.server){
            debugger
        }
        s.client.close();
        s.server.close();
    }
    serverBinds.delete(id);
}

// 导出 ServerBind 类
module.exports = {GetServerBind, CreateServerBind, RemoveServerBind};
