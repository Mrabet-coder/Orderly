import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

export interface SegmentRules {
  minOrders?: number;
  maxOrders?: number;
  minLtv?: number;
  maxLtv?: number;
  inactiveDays?: number;
  activeDays?: number;
  maxReturnRate?: number;
  minConfirmationRate?: number;
  cities?: string[];
  products?: string[];
  tags?: string[];
}

@Injectable()
export class MarketingService {
  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
  ) {}

  // ---------- SEGMENTS ----------

  async listSegments() {
    const segments = await this.prisma.segment.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Compute size of each segment
    const customers = await this.orders.getCustomers({});
    return segments.map((s) => ({
      ...s,
      size: this.matchCustomers(customers, s.rules as SegmentRules).length,
    }));
  }

  async createSegment(data: { name: string; description?: string; rules: SegmentRules }) {
    return this.prisma.segment.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        rules: data.rules as any,
      },
    });
  }

  async updateSegment(id: string, data: { name?: string; description?: string; rules?: SegmentRules }) {
    return this.prisma.segment.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.rules && { rules: data.rules as any }),
      },
    });
  }

  async deleteSegment(id: string) {
    return this.prisma.segment.delete({ where: { id } });
  }

  async previewSegment(rules: SegmentRules) {
    const customers = await this.orders.getCustomers({});
    const matched = this.matchCustomers(customers, rules);
    return {
      size: matched.length,
      totalValue: matched.reduce((s: number, c: any) => s + c.lifetimeValue, 0),
      sample: matched.slice(0, 10).map((c: any) => ({
        name: c.name,
        phone: c.displayPhone,
        city: c.city,
        totalOrders: c.totalOrders,
        lifetimeValue: c.lifetimeValue,
      })),
    };
  }

  private matchCustomers(customers: any[], rules: SegmentRules): any[] {
    return customers.filter((c) => {
      if (rules.minOrders !== undefined && c.totalOrders < rules.minOrders) return false;
      if (rules.maxOrders !== undefined && c.totalOrders > rules.maxOrders) return false;
      if (rules.minLtv !== undefined && c.lifetimeValue < rules.minLtv) return false;
      if (rules.maxLtv !== undefined && c.lifetimeValue > rules.maxLtv) return false;
      if (rules.inactiveDays !== undefined && c.daysSinceLast < rules.inactiveDays) return false;
      if (rules.activeDays !== undefined && c.daysSinceLast > rules.activeDays) return false;
      if (rules.maxReturnRate !== undefined && c.returnRate > rules.maxReturnRate) return false;
      if (rules.minConfirmationRate !== undefined && c.confirmationRate < rules.minConfirmationRate) return false;
      if (rules.cities?.length && !rules.cities.includes(c.city)) return false;
      if (rules.tags?.length && !rules.tags.some((t) => (c.tags ?? []).includes(t))) return false;
      if (rules.products?.length) {
        const bought = (c.topProducts ?? []).map((p: any) => p.title);
        if (!rules.products.some((p) => bought.includes(p))) return false;
      }
      return true;
    });
  }

  // ---------- CAMPAIGNS ----------

  async listCampaigns() {
    return this.prisma.campaign.findMany({
      include: { segment: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(data: {
    name: string;
    message: string;
    segmentId?: string;
    channel?: string;
    scheduledAt?: string;
  }) {
    let recipientCount = 0;
    if (data.segmentId) {
      const segment = await this.prisma.segment.findUnique({ where: { id: data.segmentId } });
      if (segment) {
        const customers = await this.orders.getCustomers({});
        recipientCount = this.matchCustomers(customers, segment.rules as SegmentRules).length;
      }
    }

    return this.prisma.campaign.create({
      data: {
        name: data.name,
        message: data.message,
        segmentId: data.segmentId ?? null,
        channel: data.channel ?? 'SMS',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        recipientCount,
      },
    });
  }

  async sendCampaign(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { segment: true },
    });
    if (!campaign) throw new Error('Campaign not found');
    if (!campaign.segmentId || !campaign.segment) throw new Error('No segment selected');

    const customers = await this.orders.getCustomers({});
    const matched = this.matchCustomers(customers, campaign.segment.rules as SegmentRules);

    await this.prisma.campaign.update({
      where: { id },
      data: { status: 'SENDING', recipientCount: matched.length },
    });

    let sent = 0;
    let failed = 0;

    for (const c of matched) {
      const personalized = this.renderTemplate(campaign.message, c);
      try {
        // TODO: plug real SMS provider here
        const ok = await this.sendSms(c.displayPhone, personalized);
        await this.prisma.campaignSend.create({
          data: {
            campaignId: id,
            phone: c.displayPhone,
            name: c.name,
            message: personalized,
            status: ok ? 'SENT' : 'FAILED',
            error: ok ? null : 'SMS provider not configured',
            sentAt: ok ? new Date() : null,
          },
        });
        if (ok) sent++; else failed++;
      } catch (e: any) {
        failed++;
        await this.prisma.campaignSend.create({
          data: {
            campaignId: id,
            phone: c.displayPhone,
            name: c.name,
            message: personalized,
            status: 'FAILED',
            error: e?.message ?? 'unknown',
          },
        });
      }
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        status: failed === matched.length ? 'FAILED' : 'SENT',
        sentAt: new Date(),
        sentCount: sent,
        failedCount: failed,
      },
    });
  }

  async getCampaignSends(id: string) {
    return this.prisma.campaignSend.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async deleteCampaign(id: string) {
    return this.prisma.campaign.delete({ where: { id } });
  }

  private renderTemplate(template: string, customer: any): string {
    return template
      .replace(/\{\{nom\}\}/gi, customer.name ?? 'Client')
      .replace(/\{\{ville\}\}/gi, customer.city ?? '')
      .replace(/\{\{commandes\}\}/gi, String(customer.totalOrders ?? 0))
      .replace(/\{\{valeur\}\}/gi, String(Math.round(customer.lifetimeValue ?? 0)))
      .replace(/\{\{produit\}\}/gi, customer.topProducts?.[0]?.title ?? '');
  }

  private async sendSms(phone: string, message: string): Promise<boolean> {
    const apiKey = process.env.SMS_API_KEY;
    const apiUrl = process.env.SMS_API_URL;
    if (!apiKey || !apiUrl) {
      // Provider not configured — simulate
      console.log(`[SMS SIMULÉ] ${phone} : ${message}`);
      return false;
    }
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ to: phone, message }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ---------- FLOWS ----------

  async listFlows() {
    return this.prisma.flow.findMany({
      include: { segment: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFlow(data: {
    name: string;
    description?: string;
    trigger: string;
    triggerConfig?: any;
    segmentId?: string;
    message: string;
    delayHours?: number;
  }) {
    return this.prisma.flow.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        trigger: data.trigger,
        triggerConfig: data.triggerConfig ?? {},
        segmentId: data.segmentId ?? null,
        message: data.message,
        delayHours: data.delayHours ?? 0,
      },
    });
  }

  async toggleFlow(id: string) {
    const flow = await this.prisma.flow.findUnique({ where: { id } });
    if (!flow) throw new Error('Flow not found');
    return this.prisma.flow.update({
      where: { id },
      data: { isActive: !flow.isActive },
    });
  }

  async deleteFlow(id: string) {
    return this.prisma.flow.delete({ where: { id } });
  }

  async seedDefaultSegments() {
    const defaults = [
      {
        name: 'Clients fidèles',
        description: '2 commandes ou plus',
        rules: { minOrders: 2 },
      },
      {
        name: 'VIP',
        description: 'Plus de 500 TND dépensés',
        rules: { minLtv: 500 },
      },
      {
        name: 'Clients inactifs',
        description: 'Pas de commande depuis 30 jours',
        rules: { inactiveDays: 30, minOrders: 1 },
      },
      {
        name: 'Nouveaux clients',
        description: 'Une seule commande',
        rules: { minOrders: 1, maxOrders: 1 },
      },
      {
        name: 'Clients fiables',
        description: 'Taux de confirmation élevé, peu de retours',
        rules: { minConfirmationRate: 70, maxReturnRate: 20 },
      },
    ];

    const created: any[] = [];
    for (const d of defaults) {
      const exists = await this.prisma.segment.findFirst({ where: { name: d.name } });
      if (exists) continue;
      created.push(
        await this.prisma.segment.create({
          data: { name: d.name, description: d.description, rules: d.rules as any, isSystem: true },
        }),
      );
    }
    return { created: created.length };
  }
}