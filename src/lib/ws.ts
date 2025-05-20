import { createWorker } from "../lib/worker";
import WebSocket from "ws";
import { createWebRtcTransport } from "./createWebRtcTransport";
import { types } from "mediasoup";

let mediasoupRouter: types.Router;
const peers = new Map<WebSocket, {
    producerTransport?: types.Transport;
    consumerTransport?: types.Transport;
    producer?: types.Producer;
    consumer?: types.Consumer;
}>();

const producers: { ws: WebSocket, producer: types.Producer }[] = [];

const WebSocketConnection = async (websock: WebSocket.Server) => {
    mediasoupRouter = await createWorker();

    websock.on('connection', (ws: WebSocket) => {
        peers.set(ws, {});

        ws.on('message', async (message: string) => {
            if (!IsJsonString(message)) return;

            const event = JSON.parse(message);

            switch (event.type) {
                case 'getRouterRtpCapabilities':
                    onRouterRtpCapabilities(ws);
                    break;
                case 'createProducerTransport':
                    onCreateProducerTransport(ws);
                    break;
                case 'connectProducerTransport':
                    onConnectProducerTransport(event, ws);
                    break;
                case 'produce':
                    onProduce(event, ws, websock);
                    break;
                case 'createConsumerTransport':
                    onCreateConsumerTransport(ws);
                    break;
                case 'connectConsumerTransport':
                    onConnectConsumerTransport(event, ws);
                    break;
                case 'resume':
                    onResume(ws);
                    break;
                case 'consume':
                    onConsume(event, ws);
                    break;
                default:
                    break;
            }
        });

        ws.on('close', () => {
            const peer = peers.get(ws);
            if (!peer) return;

            if (peer.producer) {
                const idx = producers.findIndex(p => p.ws === ws);
                if (idx !== -1) producers.splice(idx, 1);
                peer.producer.close();
            }

            peer.producerTransport?.close();
            peer.consumerTransport?.close();
            peer.consumer?.close();

            peers.delete(ws);
        });
    });

    const onRouterRtpCapabilities = (ws: WebSocket) => {
        send(ws, "routerCapabilities", mediasoupRouter.rtpCapabilities);
    };

    const onCreateProducerTransport = async (ws: WebSocket) => {
        const { transport, params } = await createWebRtcTransport(mediasoupRouter);
        const peer = peers.get(ws);
        if (!peer) return;
        peer.producerTransport = transport;
        send(ws, 'producerTransportCreated', params);
    };

    const onConnectProducerTransport = async (event: any, ws: WebSocket) => {
        const peer = peers.get(ws);
        if (!peer?.producerTransport) return;
        await peer.producerTransport.connect({ dtlsParameters: event.dtlsParameters });
        send(ws, 'producerConnected', 'producer connected!');
    };

    const onProduce = async (event: any, ws: WebSocket, webSocket: WebSocket.Server) => {
        const peer = peers.get(ws);
        if (!peer?.producerTransport) return;

        const { kind, rtpParameters } = event;
        const newProducer = await peer.producerTransport.produce({ kind, rtpParameters });

        peer.producer = newProducer;
        producers.push({ ws, producer: newProducer });

        send(ws, 'produced', { id: newProducer.id });
        broadcast(webSocket, 'newProducer', 'new user', ws);

    };

    const onCreateConsumerTransport = async (ws: WebSocket) => {
        const { transport, params } = await createWebRtcTransport(mediasoupRouter);
        const peer = peers.get(ws);
        if (!peer) return;
        peer.consumerTransport = transport;
        send(ws, 'subTransportCreated', params);
    };

    const onConnectConsumerTransport = async (event: any, ws: WebSocket) => {
        const peer = peers.get(ws);
        if (!peer?.consumerTransport) return;
        await peer.consumerTransport.connect({ dtlsParameters: event.dtlsParameters });
        send(ws, 'subConnected', 'consumer transport connected');
    };

    const onConsume = async (event: any, ws: WebSocket) => {
        const peer = peers.get(ws);
        if (!peer?.consumerTransport) return;

        const rtpCapabilities = event.rtpCapabilities;

        const availableProducer = producers.find(p => p.ws !== ws);
        if (!availableProducer) {
            send(ws, 'error', 'No other producers available');
            return;
        }

        const selectedProducer = availableProducer.producer;
        const canConsume = mediasoupRouter.canConsume({
            producerId: selectedProducer.id,
            rtpCapabilities
        });

        if (!canConsume) {
            send(ws, 'error', 'Cannot consume selected producer');
            return;
        }

        let consumer: types.Consumer;
        try {
            consumer = await peer.consumerTransport.consume({
                producerId: selectedProducer.id,
                rtpCapabilities,
                paused: selectedProducer.kind === "video"
            });
            peer.consumer = consumer;
        } catch (error) {
            console.error("Consume failed:", error);
            send(ws, 'error', 'Failed to create consumer');
            return;
        }

        const resp = {
            producerId: selectedProducer.id,
            id: consumer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
            producerPaused: consumer.producerPaused
        };
        send(ws, 'subscribed', resp);
    };

    const onResume = async (ws: WebSocket) => {
        const peer = peers.get(ws);
        if (!peer?.consumer) return;
        await peer.consumer.resume();
        send(ws, 'resumed', 'resumed');
    };

    const send = (ws: WebSocket, type: string, msg: any) => {
        const message = JSON.stringify({ type, data: msg });
        ws.send(message);
    };

    const broadcast = (
    ws: WebSocket.Server,
    type: string,
    msg: any,
    exclude?: WebSocket
) => {
    const message = JSON.stringify({ type, data: msg });
    ws.clients.forEach(client => {
        if (client !== exclude && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

    const IsJsonString = (str: string) => {
        try {
            JSON.parse(str);
        } catch {
            return false;
        }
        return true;
    };
};

export { WebSocketConnection };
