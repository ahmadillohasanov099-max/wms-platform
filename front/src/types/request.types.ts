import type { User } from './user.types';
import type { Organization } from './organization.types';

export type RequestEntityType = 'USER' | 'DEPARTMENT' | 'PRODUCT' | 'ASSET';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RequestItem {
  id: string;
  entityType: RequestEntityType;
  entityId: string;
  entityTitle?: string;
  entityName?: string;
  reason: string;
  status: RequestStatus;
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

export interface CreateRequestDto {
  entityType: RequestEntityType;
  entityId: string;
  entityName?: string;
  reason: string;
}

export interface ReviewRequestDto {
  reviewComment?: string;
  rejectionReason?: string;
}

// Backward compatibility type aliases
export type DeletionEntityType = RequestEntityType;
export type DeletionStatus = RequestStatus;
export type DeletionRequest = RequestItem;
export type CreateDeletionRequestDto = CreateRequestDto;
export type RejectDeletionRequestDto = ReviewRequestDto;
