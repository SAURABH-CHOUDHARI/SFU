import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';

const liveStreams: Set<string> = new Set();

export const watchHLS = (hlsDir: string) => {
    const absolutePath = path.resolve(hlsDir);

    // Verify directory exists
    if (!fs.existsSync(absolutePath)) {
        console.error(`[HLS] Directory does not exist: ${absolutePath}`);
        throw new Error(`Directory ${absolutePath} does not exist`);
    }


    const watcher = chokidar.watch(absolutePath, {
        ignoreInitial: false,
        persistent: true,
        awaitWriteFinish: {
            stabilityThreshold: 1000,
            pollInterval: 100
        },
        ignorePermissionErrors: true,
        usePolling: true,
        interval: 500,
        ignored: ['**/*.!(m3u8)', '!stream*.m3u8']
    });

    watcher.on('ready', () => {
        const watched = watcher.getWatched();
        Object.entries(watched).forEach(([dir, files]) => {
            files.forEach(file => {
                const fullPath = path.join(dir, file);
                if (file.match(/^stream\d*\.m3u8$/)) {
                    console.log('[HLS] Found existing stream:', fullPath);
                    liveStreams.add(file);
                }
            });
        });
    });

    watcher.on('add', (filePath) => {
        const fileName = path.basename(filePath);
        if (fileName.match(/^stream\d*\.m3u8$/)) {
            liveStreams.add(fileName);
            console.log(`[HLS] Stream started: ${fileName} (Total live: ${liveStreams.size})`);
            console.log('Current live streams:', Array.from(liveStreams));
        }
    });

    watcher.on('unlink', (filePath) => {
        const fileName = path.basename(filePath);
        if (fileName.match(/^stream\d*\.m3u8$/)) {
            liveStreams.delete(fileName);
            console.log(`[HLS] Stream ended: ${fileName} (Total live: ${liveStreams.size})`);
            console.log('Current live streams:', Array.from(liveStreams));
        }
    });

    watcher.on('change', (filePath) => {
        const fileName = path.basename(filePath);
        if (fileName.match(/^stream\d*\.m3u8$/)) {
            console.log(`[HLS] Stream updated: ${fileName}`);
        }
    });

    watcher.on('error', (err) => {
        console.error(`[HLS Watcher Error]`, err);
    });

    watcher.on('raw', (event, path, details) => {
        console.log('[HLS] Raw event:', event, path, details);
    });

    // Manual scan for debugging
    setTimeout(() => {
        fs.readdirSync(absolutePath).forEach(file => {
            if (file.match(/^stream\d*\.m3u8$/)) {
                console.log('[HLS] Manual scan found:', file);
                liveStreams.add(file);
            }
        });
    }, 3000);

    return watcher;
};

export const getLiveStreamFiles = (): string[] => Array.from(liveStreams);
