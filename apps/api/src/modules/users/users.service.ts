import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        storeAccess: {
          select: { storeId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        storeAccess: { select: { storeId: true } },
      },
    });
  }

  async create(data: {
    email: string;
    name: string;
    role: 'SUPER_ADMIN' | 'STORE_MANAGER' | 'STAFF';
    password?: string;
    permissions?: string[];
    storeIds?: string[];
  }) {
    const passwordHash = await bcrypt.hash(data.password ?? 'changeme123', 10);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        passwordHash,
        permissions: data.permissions ?? [],
        storeAccess: data.storeIds?.length
          ? {
              create: data.storeIds.map((storeId) => ({ storeId })),
            }
          : undefined,
      },
    });

    return user;
  }

  async invite(data: {
    email: string;
    name: string;
    role: 'SUPER_ADMIN' | 'STORE_MANAGER' | 'STAFF';
    permissions: string[];
    storeIds?: string[];
  }) {
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('User already exists');

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        passwordHash: '',
        permissions: data.permissions,
        inviteToken,
        inviteExpiry,
        isActive: false,
        storeAccess: data.storeIds?.length
          ? { create: data.storeIds.map((storeId) => ({ storeId })) }
          : undefined,
      },
    });

    return {
      user,
      inviteToken,
      inviteUrl: `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/accept-invite?token=${inviteToken}`,
    };
  }

  async acceptInvite(token: string, password: string, name?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        inviteToken: token,
        inviteExpiry: { gt: new Date() },
      },
    });

    if (!user) throw new Error('Invalid or expired invite token');

    const passwordHash = await bcrypt.hash(password, 10);

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        name: name ?? user.name,
        isActive: true,
        inviteToken: null,
        inviteExpiry: null,
      },
    });
  }

  async updateRole(id: string, role: 'SUPER_ADMIN' | 'STORE_MANAGER' | 'STAFF') {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  async updatePermissions(id: string, permissions: string[]) {
    return this.prisma.user.update({
      where: { id },
      data: { permissions },
    });
  }

  async updateStores(id: string, storeIds: string[]) {
    await this.prisma.userStoreAccess.deleteMany({ where: { userId: id } });
    if (storeIds.length > 0) {
      await this.prisma.userStoreAccess.createMany({
        data: storeIds.map((storeId) => ({ userId: id, storeId })),
      });
    }
    return this.findOne(id);
  }

  async toggleActive(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}