import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    orderId?: string;
    actorName?: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  // Detect @mentions in a text and notify those users
  async processMentions(
    text: string,
    context: { link?: string; orderId?: string; orderNumber?: string },
    actorId: string,
  ) {
    if (!text) return { notified: 0 };

    const matches = text.match(/@([A-Za-zÀ-ÿ0-9._-]+(?:\s[A-Za-zÀ-ÿ]+)?)/g);
    if (!matches) return { notified: 0 };

    const users = await this.prisma.user.findMany({
      select: { id: true, name: true, email: true },
    });

    const actor = users.find((u) => u.id === actorId);
    const actorName = actor?.name ?? 'Quelqu\'un';

    const notified: string[] = [];

    for (const raw of matches) {
      const mention = raw.slice(1).trim().toLowerCase();
      const user = users.find(
        (u) =>
          u.name.toLowerCase() === mention ||
          u.name.toLowerCase().replace(/\s/g, '') === mention.replace(/\s/g, '') ||
          u.email.split('@')[0].toLowerCase() === mention,
      );
      if (!user || user.id === actorId || notified.includes(user.id)) continue;

      await this.prisma.notification.create({
        data: {
          userId: user.id,
          type: 'mention',
          title: `${actorName} vous a mentionné`,
          message: context.orderNumber
            ? `Commande ${context.orderNumber} : ${text.slice(0, 120)}`
            : text.slice(0, 140),
          link: context.link ?? null,
          orderId: context.orderId ?? null,
          actorName,
        },
      });
      notified.push(user.id);
    }

    return { notified: notified.length };
  }
}