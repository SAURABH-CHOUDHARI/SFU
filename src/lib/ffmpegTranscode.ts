import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import path from 'path';
import liveHls_path from '../../liveHlsPath';

interface FFmpegParams {
    ip: string;
    port: number;
    streamName: string;
    kind: 'video' | 'audio'; // Added so we know what codec info to put in SDP
}

let ffmpegProcesses: Map<string, ChildProcessWithoutNullStreams> = new Map();

export function startFfmpegTranscoding({ ip, port, streamName, kind }: FFmpegParams) {
    const outputPath = path.join(liveHls_path, `${streamName}.m3u8`);
    const sdpPath = path.join(liveHls_path, `${streamName}.sdp`);

    if (ffmpegProcesses.has(streamName)) {
        console.log(`[FFmpeg ${streamName}] Killing existing process before starting a new one.`);
        ffmpegProcesses.get(streamName)?.kill('SIGINT');
        ffmpegProcesses.delete(streamName);
    }

    // Create an SDP file based on the kind of stream
    const sdpContent =
`v=0
o=- 0 0 IN IP4 ${ip}
s=No Name
c=IN IP4 ${ip}
t=0 0
m=${kind} ${port} RTP/AVP ${kind === 'video' ? '96' : '97'}
a=rtpmap:${kind === 'video' ? '96 H264/90000' : '97 MPEG4-GENERIC/48000/2'}
${kind === 'audio' ? 'a=fmtp:97 streamtype=5; profile-level-id=15; mode=AAC-hbr; config=1190; SizeLength=13; IndexLength=3; IndexDeltaLength=3;' : ''}
`;

    fs.writeFileSync(sdpPath, sdpContent);

    const ffmpegArgs = [
        '-protocol_whitelist', 'file,udp,rtp',
        '-fflags', 'nobuffer',
        '-use_wallclock_as_timestamps', '1',
        '-flush_packets', '1',
        '-loglevel', 'debug',
        '-i', sdpPath,
        '-c:v', kind === 'video' ? 'libx264' : 'copy',
        '-c:a', kind === 'audio' ? 'aac' : 'copy',
        '-f', 'hls',
        '-hls_time', '4',
        '-hls_list_size', '5',
        '-hls_flags', 'append_list',
        outputPath
    ];

    console.log(`[FFmpeg ${streamName}] Starting with args: ${ffmpegArgs.join(' ')}`);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    ffmpeg.stdout.on('data', data => {
        console.log(`[FFmpeg ${streamName}] stdout: ${data.toString()}`);
    });

    ffmpeg.stderr.on('data', data => {
        console.error(`[FFmpeg ${streamName}] stderr: ${data.toString()}`);
    });

    ffmpeg.on('close', code => {
        console.log(`[FFmpeg ${streamName}] exited with code ${code}`);
        ffmpegProcesses.delete(streamName);
        fs.unlinkSync(sdpPath); // clean up
    });

    ffmpegProcesses.set(streamName, ffmpeg);

    return ffmpeg;
}
