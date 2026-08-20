import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsService } from './departments.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from 'src/common/services/audit.service';

const mockPrismaService = {
  department: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    count: jest.fn(),
  },
  assignment: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  departmentAsset: {
    aggregate: jest.fn(),
  },
};

const mockAuditService = {
  log: jest.fn(),
};

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a department if found', async () => {
      const mockDept = { id: '1', name: 'IT Bo‘limi', deletedAt: null };
      prisma.department.findFirst.mockResolvedValue(mockDept);
      prisma.assignment.findMany.mockResolvedValue([]);

      const result = await service.findOne('1');
      expect(result).toEqual({ ...mockDept, assignments: [] });
      expect(prisma.department.findFirst).toHaveBeenCalledWith({
        where: { id: '1', deletedAt: null },
        include: {
          users: {
            where: { deletedAt: null, isActive: true },
            select: {
              id: true,
              fullName: true,
              username: true,
              phone: true,
              internalPhone: true,
              position: true,
            },
          },
          departmentAssets: {
            include: {
              product: {
                select: { id: true, name: true, productType: true, unit: true },
              },
            },
          },
        },
      });
    });

    it('should throw NotFoundException if department not found', async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
