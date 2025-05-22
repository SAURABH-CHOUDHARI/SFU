import { Router, PlainTransport } from 'mediasoup/node/lib/types';

// Map to store transports per stream id (or producer id)
const ffmpegTransports: Map<string, PlainTransport> = new Map();

export async function createFfmpegTransportForStream(router: Router, streamId: string): Promise<PlainTransport> {
    // If transport already exists for this stream, return it
    if (ffmpegTransports.has(streamId)) {
        return ffmpegTransports.get(streamId)!;
    }

    // Create new PlainTransport for this stream
    const transport = await router.createPlainTransport({
        listenIp: "127.0.0.1",
        rtcpMux: false,
        comedia: true,
    });

    console.log(`[FFmpeg Transport for ${streamId}]`, {
        ip: transport.tuple.localIp,
        port: transport.tuple.localPort,
        rtcpPort: transport.rtcpTuple?.localPort,
    });

    // Store it
    ffmpegTransports.set(streamId, transport);

    return transport;
}

export function getFfmpegTransport(streamId: string): PlainTransport | undefined {
    return ffmpegTransports.get(streamId);
}

export async function closeFfmpegTransport(streamId: string) {
    const transport = ffmpegTransports.get(streamId);
    if (transport) {
        await transport.close();
        ffmpegTransports.delete(streamId);
        console.log(`[FFmpeg Transport for ${streamId}] closed`);
    }
}
