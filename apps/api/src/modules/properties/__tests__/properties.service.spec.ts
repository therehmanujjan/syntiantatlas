import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PropertiesService } from '../properties.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let prisma: any;
  let auditService: any;

  const mockProperty = {
    id: 1,
    title: 'Luxury Apartment',
    description: 'A premium property',
    location: 'Downtown',
    address: '123 Main St',
    city: 'Karachi',
    propertyType: 'apartment',
    areaSqft: new Decimal(1500),
    totalValue: new Decimal(500000),
    fundingTarget: new Decimal(200000),
    fundingRaised: new Decimal(50000),
    minInvestment: new Decimal(5000),
    maxInvestment: new Decimal(50000),
    expectedReturnsAnnual: new Decimal(12),
    rentalYield: new Decimal(8),
    status: 'active',
    sellerId: 10,
    createdAt: new Date(),
    seller: { id: 10, firstName: 'Ali', lastName: 'Khan', email: 'ali@test.com' },
    _count: { investments: 3 },
  };

  beforeEach(async () => {
    prisma = {
      property: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      investment: {
        count: jest.fn(),
      },
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return paginated properties', async () => {
      prisma.property.findMany.mockResolvedValue([mockProperty]);
      prisma.property.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should default to page 1 and limit 20', async () => {
      prisma.property.findMany.mockResolvedValue([]);
      prisma.property.count.mockResolvedValue(0);

      await service.findAll({});

      expect(prisma.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should cap limit at 100', async () => {
      prisma.property.findMany.mockResolvedValue([]);
      prisma.property.count.mockResolvedValue(0);

      await service.findAll({ limit: 500 });

      expect(prisma.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should filter by city', async () => {
      prisma.property.findMany.mockResolvedValue([]);
      prisma.property.count.mockResolvedValue(0);

      await service.findAll({ city: 'Karachi' });

      expect(prisma.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            city: { contains: 'Karachi', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should apply search across title, description, city', async () => {
      prisma.property.findMany.mockResolvedValue([]);
      prisma.property.count.mockResolvedValue(0);

      await service.findAll({ search: 'luxury' });

      expect(prisma.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: 'luxury', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  // ── findOne ──

  describe('findOne', () => {
    it('should return property with investor count', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.investment.count.mockResolvedValue(5);

      const result = await service.findOne(1);

      expect(result.title).toBe('Luxury Apartment');
      expect(result.investorCount).toBe(5);
    });

    it('should throw NotFoundException for non-existent property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ──

  describe('create', () => {
    it('should create a property with pending status', async () => {
      prisma.property.create.mockResolvedValue({ ...mockProperty, status: 'pending' });

      await service.create(
        {
          title: 'New Property',
          description: 'Description',
          location: 'Location',
          address: '456 St',
          city: 'Lahore',
          propertyType: 'house',
          totalValue: 500000,
          fundingTarget: 200000,
          minInvestment: 5000,
          maxInvestment: 50000,
        },
        10,
        '127.0.0.1',
      );

      expect(prisma.property.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending', sellerId: 10 }),
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create_property' }),
      );
    });
  });

  // ── update ──

  describe('update', () => {
    it('should allow admin to update any property', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue({ ...mockProperty, title: 'Updated' });

      const result = await service.update(1, { title: 'Updated' }, 99, 'admin');

      expect(result.title).toBe('Updated');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update_property' }),
      );
    });

    it('should allow seller to update their own pending property', async () => {
      prisma.property.findUnique.mockResolvedValue({ ...mockProperty, status: 'pending' });
      prisma.property.update.mockResolvedValue({ ...mockProperty, title: 'Updated' });

      await service.update(1, { title: 'Updated' }, 10, 'seller');

      expect(prisma.property.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);

      await expect(
        service.update(999, { title: 'X' }, 10, 'seller'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if seller does not own property', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);

      await expect(
        service.update(1, { title: 'X' }, 99, 'seller'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if seller edits active property', async () => {
      prisma.property.findUnique.mockResolvedValue({ ...mockProperty, status: 'active' });

      await expect(
        service.update(1, { title: 'X' }, 10, 'seller'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set status back to pending when seller edits rejected property', async () => {
      prisma.property.findUnique.mockResolvedValue({ ...mockProperty, status: 'rejected' });
      prisma.property.update.mockResolvedValue({ ...mockProperty, status: 'pending' });

      await service.update(1, { title: 'Fixed' }, 10, 'seller');

      expect(prisma.property.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should delete property with no investments', async () => {
      prisma.property.findUnique.mockResolvedValue({
        ...mockProperty,
        _count: { investments: 0 },
      });

      const result = await service.delete(1, 10, 'seller');

      expect(result.message).toBe('Property deleted successfully');
      expect(prisma.property.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException for non-existent property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);

      await expect(service.delete(999, 10, 'seller')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if seller does not own property', async () => {
      prisma.property.findUnique.mockResolvedValue({
        ...mockProperty,
        _count: { investments: 0 },
      });

      await expect(service.delete(1, 99, 'seller')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if property has investments', async () => {
      prisma.property.findUnique.mockResolvedValue({
        ...mockProperty,
        _count: { investments: 5 },
      });

      await expect(service.delete(1, 10, 'seller')).rejects.toThrow(BadRequestException);
    });

    it('should allow admin to delete any property', async () => {
      prisma.property.findUnique.mockResolvedValue({
        ...mockProperty,
        _count: { investments: 0 },
      });

      const result = await service.delete(1, 99, 'admin');

      expect(result.message).toBe('Property deleted successfully');
    });
  });

  // ── updateStatus (admin) ──

  describe('updateStatus', () => {
    it('should update property status', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue({ ...mockProperty, status: 'approved' });

      const result = await service.updateStatus(
        1,
        { status: 'approved' },
        99,
        '127.0.0.1',
      );

      expect(result.status).toBe('approved');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'property_approved' }),
      );
    });

    it('should throw NotFoundException for non-existent property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(999, { status: 'approved' }, 99),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getSellerProperties ──

  describe('getSellerProperties', () => {
    it('should return properties for a given seller', async () => {
      prisma.property.findMany.mockResolvedValue([mockProperty]);

      const result = await service.getSellerProperties(10);

      expect(result).toHaveLength(1);
      expect(prisma.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sellerId: 10 } }),
      );
    });
  });

  // ── getPending ──

  describe('getPending', () => {
    it('should return pending properties ordered by creation date', async () => {
      prisma.property.findMany.mockResolvedValue([mockProperty]);

      await service.getPending();

      expect(prisma.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });
});
