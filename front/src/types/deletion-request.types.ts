import type { User } from './user.types';
import type { Organization } from './organization.types';

export type DeletionEntityType = 'USER' | 'DEPARTMENT' | 'PRODUCT' | 'ASSET';
export type DeletionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DeletionRequest {
  id: string;
  entityType: DeletionEntityType;
  entityId: string;
  entityTitle?: string;
  entityName?: string;
  reason: string;
  status: DeletionStatus;
  rejectionReason?: string;
  reviewComment?: string;
  requestedById: string;
  requestedBy?: User;
  reviewedById?: string;
  reviewedBy?: User;
  reviewedAt?: string;
  organizationId: string;
  organization?: Organization;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeletionRequestDto {
  entityType: DeletionEntityType;
  entityId: string;
  reason: string;
}

export interface RejectDeletionRequestDto {
  rejectionReason: string;
}
