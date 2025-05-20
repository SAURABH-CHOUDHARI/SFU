import chokidar from 'chokidar';
import path from 'path';

let isLive = false;

export const watchHLS = (hlsDir: string) => {
    const streamPath = path.join(hlsDir, 'stream.m3u8');

    const watcher = chokidar.watch(streamPath, {
        ignoreInitial: false,
        persistent: true,
    });

    watcher.on('add', () => {
        isLive = true;
        console.log(`[HLS] Live stream started.`);
    });

    watcher.on('unlink', () => {
        isLive = false;
        console.log(`[HLS] Live stream ended.`);
    });

    watcher.on('error', (error) => {
        console.error(`[HLS Watcher Error]`, error);
    });

    console.log(`[HLS] Watching single-room stream at: ${streamPath}`);
};

export const isStreamLive = (): boolean => isLive;
