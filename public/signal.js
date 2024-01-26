
class SignalService {
    constructor(inputVideo) {
        const ws = new WebSocket('ws://127.0.0.1:3000');
        this.peerConnection = new RTCPeerConnection();
        this.channelId = null;
        this.stream = null;
        this.video = null;
        this.onChannelChange = null;
        ws.onopen = () => {
            console.log('Connected to signaling server');
        };
        ws.onclose = () => {
            console.log('Disconnected from signaling server');
        }
        ws.onmessage = (message) => {
            // 解析消息
            const data = JSON.parse(message.data);
            const type = data.type;
            const payload = data.payload;

            switch (type) {
                case 'offer':{
                    this.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(payload)))).then(() => {
                        // 创建 answer
                        this.peerConnection.createAnswer().then(answer => {
                            // 设置本地描述
                            this.peerConnection.setLocalDescription(answer).then(() => {
                                // answer 转 base64
                                const answerBase64 = btoa(JSON.stringify(answer));
                                ws.send(JSON.stringify({
                                    type: 'answer',
                                    channel_id: this.channelId,
                                    payload: answerBase64,
                                    role: 'client'
                                }));
                            }).catch(() => {
                                console.error('Error setting local description');
                            })
                        }).catch(error => {
                            console.error('Error creating answer:', error);
                        });
                    }).catch(() => {
                        console.error('Error setting remote description');
                    });
                    break;
                }
                case 'answer':{
                    this.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(payload)))).then(() => {
                        console.log('Remote description set successfully');
                    }).catch(() => {
                        console.error('Error setting remote description');
                    })
                    break;
                }
                case 'candidate':{
                    this.peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(atob(payload)))).then(() => {
                        console.log('Ice candidate added successfully');
                    }).catch(error => {
                        console.error('Error adding ice candidate:', error);
                    })
                    break;
                }
            }
        }
        this.ws = ws
        fetch('http://127.0.0.1:8080/create')
            .then(response => response.json())
            .then(result => {
                this.channelId = result.data.channel_id;
                // 根据获得的channel_id，向信令服务器申请建立对等连接
                this.ws.send(JSON.stringify({ type: 'join', channel_id: this.channelId, role: 'client' }));
                if(this.onChannelChange){
                    this.onChannelChange(this.channelId);
                }
            })
            .catch(error => {
                console.error('Error creating room:', error);
            });
        // 设置ice candidate事件处理程序
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // TODO: 发送ICE候选到对等端，通过信令服务器转发
                const candidateBase64 = btoa(JSON.stringify(event.candidate));
                this.ws.send(JSON.stringify(
                    {
                        channel_id: this.channelId,
                        type: 'candidate',
                        payload: candidateBase64,
                        role: 'client' }
                ));
            }
        };
        // 设置远程流事件处理程序
        this.peerConnection.ontrack = (event)=> {
            debugger
            this.stream = event.streams[0];
            this.video.srcObject = this.stream;
        };
        this.video = inputVideo;
    }

    join(channelId) {
        // fetch get 请求 http://127.0.0.1:8080/join
        fetch(`http://127.0.0.1:8080/join?channel_id=${channelId}&user_id=${this.channelId}`)
            .then(response => response.json())
            .then(result => {
                console.log("joinRoom:", result);
                // 设置ice candidate事件处理程序
            })
            .catch(error => {
                console.error('Error creating room:', error);
            });
    }

    live() {
        // 使用navigator.mediaDevices.getUserMedia 获取当前屏幕共享(测试)
        navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        }).then(stream => {
            this.stream = stream;
            this.video.srcObject = stream;

            // 添加本地流到RTCPeerConnection
            this.stream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.stream);
            });
            // 设置远程流事件处理程序
            // rtcPeerConnection.ontrack = handleRemoteStream;

            // 发送 offer
            this.peerConnection.createOffer().then(offer => {
                // 设置本地描述
                this.peerConnection.setLocalDescription(offer).then(() => {
                    // offer 转 base64
                    const offerBase64 = btoa(JSON.stringify(offer));
                    this.ws.send(JSON.stringify({
                        type: 'offer',
                        channel_id: this.channelId,
                        payload: offerBase64,
                        role: 'client'
                    }));
                }).catch(() => {
                    console.error('Error setting local description');
                })
            }).catch(error => {
                console.error('Error creating offer:', error);
            });
        }).catch(error => {
            console.error('Error accessing media devices.', error);
        })
    }

    close() {
        // 关闭WebSocket连接
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // 关闭本地流
        if(this.stream){
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if(this.video){
            this.video.srcObject = null;
        }

        // 关闭RTCPeerConnection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }
}

// TODO: 添加处理远程描述SDP offer的函数
// function handleOffer(offer) { }

// TODO: 添加处理远程描述SDP answer的函数
// function handleAnswer(answer) { }

// TODO: 添加处理远程ICE候选的函数
// function handleRemoteIceCandidate(candidate) { }
