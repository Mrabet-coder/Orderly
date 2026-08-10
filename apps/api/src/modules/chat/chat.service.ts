import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async listChannels(userId: string) {
    const channels = await this.prisma.channel.findMany({
      where: {
        OR: [
          { isPrivate: false, type: 'CHANNEL' },
          { members: { some: { userId } } },
        ],
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      channels.map(async (c) => {
        const member = c.members.find((m) => m.userId === userId);
        const unread = member
          ? await this.prisma.chatMessage.count({
              where: {
                channelId: c.id,
                createdAt: { gt: member.lastReadAt },
                userId: { not: userId },
              },
            })
          : 0;

        // For DMs, name = the other person
        let displayName = c.name;
        if (c.type === 'DM') {
          const other = c.members.find((m) => m.userId !== userId);
          displayName = other?.user.name ?? 'Conversation';
        }

        return {
          id: c.id,
          name: displayName,
          description: c.description,
          type: c.type,
          isPrivate: c.isPrivate,
          memberCount: c.members.length,
          members: c.members.map((m) => m.user),
          lastMessage: c.messages[0]
            ? {
                text: c.messages[0].text,
                author: c.messages[0].user.name,
                createdAt: c.messages[0].createdAt,
              }
            : null,
          unread,
        };
      }),
    );
  }

  async getMessages(channelId: string, userId: string) {
    // Auto-join public channels
    await this.ensureMember(channelId, userId);

    const messages = await this.prisma.chatMessage.findMany({
      where: { channelId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Mark as read
    await this.prisma.channelMember.updateMany({
      where: { channelId, userId },
      data: { lastReadAt: new Date() },
    });

    return messages.map((m) => ({
      id: m.id,
      text: m.text,
      orderRef: m.orderRef,
      createdAt: m.createdAt,
      userId: m.userId,
      userName: m.user.name,
      isMine: m.userId === userId,
    }));
  }

  async sendMessage(channelId: string, userId: string, text: string) {
    await this.ensureMember(channelId, userId);

    // Extract order reference (#12345 or #E-12345 or #M123456)
    const orderMatch = text.match(/#[A-Za-z0-9-]+/);
    const orderRef = orderMatch ? orderMatch[0] : null;

    const message = await this.prisma.chatMessage.create({
      data: { channelId, userId, text, orderRef },
      include: { user: { select: { name: true } } },
    });

    await this.prisma.channel.update({
      where: { id: channelId },
      data: { updatedAt: new Date() },
    });

    // Process mentions
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    await this.notifications.processMentions(
      text,
      { link: `/chat?channel=${channelId}` },
      userId,
    );

    return {
      id: message.id,
      text: message.text,
      orderRef: message.orderRef,
      createdAt: message.createdAt,
      userId: message.userId,
      userName: message.user.name,
      isMine: true,
    };
  }

  async createChannel(data: {
    name: string;
    description?: string;
    isPrivate?: boolean;
    memberIds?: string[];
  }, creatorId: string) {
    const channel = await this.prisma.channel.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        isPrivate: data.isPrivate ?? false,
        type: 'CHANNEL',
        createdBy: creatorId,
        members: {
          create: [
            { userId: creatorId },
            ...(data.memberIds ?? [])
              .filter((id) => id !== creatorId)
              .map((userId) => ({ userId })),
          ],
        },
      },
    });
    return channel;
  }

  async getOrCreateDm(userId: string, otherUserId: string) {
    // Look for existing DM between the two
    const existing = await this.prisma.channel.findFirst({
      where: {
        type: 'DM',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: otherUserId } } },
        ],
      },
    });
    if (existing) return existing;

    const other = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: { name: true },
    });

    return this.prisma.channel.create({
      data: {
        name: other?.name ?? 'Conversation',
        type: 'DM',
        isPrivate: true,
        createdBy: userId,
        members: {
          create: [{ userId }, { userId: otherUserId }],
        },
      },
    });
  }

  async deleteChannel(id: string) {
    return this.prisma.channel.delete({ where: { id } });
  }

  async unreadTotal(userId: string) {
    const members = await this.prisma.channelMember.findMany({
      where: { userId },
      select: { channelId: true, lastReadAt: true },
    });

    let total = 0;
    for (const m of members) {
      total += await this.prisma.chatMessage.count({
        where: {
          channelId: m.channelId,
          createdAt: { gt: m.lastReadAt },
          userId: { not: userId },
        },
      });
    }
    return { count: total };
  }

  private async ensureMember(channelId: string, userId: string) {
    const exists = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (exists) return;

    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (channel && !channel.isPrivate) {
      await this.prisma.channelMember.create({ data: { channelId, userId } });
    }
  }

  async seedDefaultChannels(creatorId: string) {
    const defaults = [
      { name: 'Général', description: 'Discussions générales de l\'équipe' },
      { name: 'Confirmation', description: 'Équipe confirmation' },
      { name: 'Préparation', description: 'Équipe préparation et emballage' },
      { name: 'Livraison', description: 'Suivi des livraisons et retours' },
    ];

    let created = 0;
    for (const d of defaults) {
      const exists = await this.prisma.channel.findFirst({
        where: { name: d.name, type: 'CHANNEL' },
      });
      if (exists) continue;
      await this.prisma.channel.create({
        data: {
          name: d.name,
          description: d.description,
          type: 'CHANNEL',
          isPrivate: false,
          createdBy: creatorId,
          members: { create: [{ userId: creatorId }] },
        },
      });
      created++;
    }
    return { created };
  }
}