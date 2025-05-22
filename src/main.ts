import express from 'express';
import * as  http from 'http';
import * as Websocket from 'ws';
import * as path from 'path';
import { WebSocketConnection } from './lib/ws';
import { watchHLS, getLiveStreamFiles } from './lib/hlsWatcher';
import liveHls_path from '../liveHlsPath'
import cors from 'cors';
import { clearDirectoryContents } from './lib/clearDirectoryContents';




const main = async () => {
    await clearDirectoryContents(liveHls_path); 
    const app = express();
    const port = 8000;

    app.use(cors())

    watchHLS(liveHls_path);

    app.get('/api/streams', (req, res) => {
        const files = getLiveStreamFiles();

        if (files.length > 0) {
            res.json({
                status: 'live',
                streams: files,
            });
        } else {
            res.json({ status: 'offline' });
        }
    });

    app.use('/hls', express.static(path.resolve(liveHls_path)));


    const server = http.createServer(app);
    const websocket = new Websocket.Server({ server, path: '/ws' });

    WebSocketConnection(websocket);



    server.listen(port, () => {
        console.log('Server Started on port 8000');
    });
};

export { main }