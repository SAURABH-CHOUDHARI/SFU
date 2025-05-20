import express from 'express';
import *as  http from 'http';
import * as Websocket from 'ws';
import { WebSocketConnection } from './lib/ws';
import path from 'node:path';
import { watchHLS, isStreamLive } from './hlsWatcher';



const main = async () => {
    const app = express();
    const port = 8000;

    const HLS_DIR = path.join(__dirname, 'live-hls');
    watchHLS(HLS_DIR);

    app.get('/api/stream/', (req, res) => {
        if (isStreamLive()) {
            res.json({
                status: 'live',
                // This URL points to the m3u8 playlist being served statically
                streamUrl: `http://localhost:${port}/live-hls/stream.m3u8`,
            });
        } else {
            res.json({ status: 'offline' });
        }
    });

    const server = http.createServer(app);
    const websocket = new Websocket.Server({ server, path: '/ws' });

    WebSocketConnection(websocket);



    server.listen(port, () => {
        console.log('Server Started on port 8000');
    });
};

export { main }