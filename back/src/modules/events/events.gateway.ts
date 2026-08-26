import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:user')
  handleJoinUser(client: Socket, userId: string) {
    if (userId) {
      client.join(`user:${userId}`);
      this.logger.log(`Client ${client.id} joined room user:${userId}`);
    }
  }

  // ─── REALTIME BROADCAST METHODLARI ──────────────────

  broadcastDeletionRequestCreated(data: any) {
    if (this.server) {
      this.server.emit('deletion-request:created', {
        type: 'DELETION_REQUEST_CREATED',
        timestamp: new Date().toISOString(),
        data,
      });
    }
  }

  broadcastDeletionRequestUpdated(data: any) {
    if (this.server) {
      this.server.emit('deletion-request:updated', {
        type: 'DELETION_REQUEST_UPDATED',
        timestamp: new Date().toISOString(),
        data,
      });
    }
  }

  broadcastOffboardingStarted(data: any) {
    this.server.emit('offboarding:started', {
      type: 'OFFBOARDING_STARTED',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  broadcastWarehouseApproved(data: any) {
    this.server.emit('offboarding:warehouse-approved', {
      type: 'WAREHOUSE_APPROVED',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  broadcastAssignmentCreated(data: any) {
    if (this.server) {
      this.server.emit('assignment:created', {
        type: 'ASSIGNMENT_CREATED',
        timestamp: new Date().toISOString(),
        data,
      });

      if (data?.userId) {
        this.server.to(`user:${data.userId}`).emit('assignment:new', data);
      }
      if (data?.leaderId) {
        this.server.to(`user:${data.leaderId}`).emit('assignment:new', data);
      }
    }
  }

  broadcastAssignmentUpdated(data: any) {
    if (this.server) {
      this.server.emit('assignment:updated', {
        type: 'ASSIGNMENT_UPDATED',
        timestamp: new Date().toISOString(),
        data,
      });
    }
  }

  broadcastInventoryUpdated(data: any) {
    if (this.server) {
      this.server.emit('inventory:updated', {
        type: 'INVENTORY_UPDATED',
        timestamp: new Date().toISOString(),
        data,
      });
    }
  }

  broadcastOperationCreated(data: any) {
    if (this.server) {
      this.server.emit('operation:created', {
        type: 'OPERATION_CREATED',
        timestamp: new Date().toISOString(),
        data,
      });
    }
  }

  broadcastOffboardingCompleted(data: any) {
    this.server.emit('offboarding:completed', {
      type: 'OFFBOARDING_COMPLETED',
      timestamp: new Date().toISOString(),
      data,
    });

    // Notify specific user room to trigger immediate logout modal
    if (data?.id) {
      this.server.to(`user:${data.id}`).emit('account:terminated', {
        message: "Sizning shartnomangiz bekor qilindi va tizimdan chiqarildingiz.",
      });
    }
  }
}
