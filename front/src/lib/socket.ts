import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${hostname}:4000`;
};

const SOCKET_URL = getSocketUrl();

class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
    }
    return this.socket;
  }

  joinUserRoom(userId: string) {
    if (this.socket && userId) {
      this.socket.emit('join:user', userId);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
