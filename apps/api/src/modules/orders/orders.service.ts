import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, FinancialStatus, FulfillmentStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    storeIds?: string[];
    orderStatus?: OrderStatus[];
    financialStatus?: FinancialStatus[];
    fulfillmentStatus?: FulfillmentStatus[];
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const {
      storeIds,
      orderStatus,
      financialStatus,
      fulfillmentStatus,
      search,
      page = 1,
      pageSize = 25,
    } = query;

    const where: Prisma.OrderWhereInput = {
      ...(storeIds?.length && { storeId: { in: storeIds } }),
      ...(orderStatus?.length && { orderStatus: { in: orderStatus } }),
      ...(financialStatus?.length && { financialStatus: { in: financialStatus } }),
      ...(fulfillmentStatus?.length && { fulfillmentStatus: { in: fulfillmentStatus } }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerEmail: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          lineItems: true,
          fulfillments: { orderBy: { createdAt: 'desc' }, take: 1 },
          store: { select: { name: true } },
        },
        orderBy: { sourceCreatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map((o) => ({
        ...o,
        storeName: o.store.name,
        trackingNumber: o.fulfillments[0]?.trackingNumber ?? null,
        carrier: o.fulfillments[0]?.carrier ?? null,
        itemCount: o.lineItems.reduce((s, li) => s + li.quantity, 0),
        callAttempts: (o.callAttempts as any[]) ?? [],
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: {
        lineItems: true,
        fulfillments: true,
        refunds: true,
        events: { orderBy: { createdAt: 'desc' } },
        store: { select: { name: true } },
      },
    });
    if (!o) return null;
    return {
      ...o,
      storeName: o.store.name,
      callAttempts: (o.callAttempts as any[]) ?? [],
    };
  }

  async createManual(data: any, actorId: string) {
    const orderNumber = `#M${Date.now().toString().slice(-6)}`;

    const order = await this.prisma.order.create({
      data: {
        storeId: data.storeId,
        externalOrderId: `manual_${Date.now()}`,
        orderNumber,
        financialStatus: 'PENDING',
        fulfillmentStatus: 'UNFULFILLED',
        orderStatus: 'NOUVEAU',
        customerName: data.customerName ?? null,
        customerPhone: data.customerPhone ?? null,
        shippingAddress: data.shippingAddress ?? null,
        currency: data.currency ?? 'TND',
        subtotal: data.subtotal ?? 0,
        taxTotal: 0,
        shippingTotal: 0,
        total: data.total ?? 0,
        totalRefunded: 0,
        tags: [data.source ?? 'manual'],
        sourceCreatedAt: new Date(),
        lineItems: {
          create: (data.lineItems ?? []).map((li: any) => ({
            title: li.title,
            sku: li.sku ?? null,
            quantity: li.quantity,
            price: li.price ?? 0,
            fulfilledQty: 0,
            refundedQty: 0,
          })),
        },
      },
    });

    await this.prisma.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: 'order_created_manual',
        payload: { source: data.source ?? 'manual' },
        actor: actorId,
      },
    });

    return order;
  }

  async updateOrder(
    orderId: string,
    data: any,
    actorId: string,
  ) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new Error('Order not found');

    let subtotal = Number(existing.subtotal);
    if (data.lineItems) {
      subtotal = data.lineItems.reduce((s: number, li: any) => s + li.price * li.quantity, 0);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        ...(data.customerName !== undefined && { customerName: data.customerName }),
        ...(data.customerPhone !== undefined && { customerPhone: data.customerPhone }),
        ...(data.customerPhone2 !== undefined && { customerPhone2: data.customerPhone2 }),
        ...(data.shippingAddress !== undefined && { shippingAddress: data.shippingAddress }),
        ...(data.internalNote !== undefined && { internalNote: data.internalNote }),
        ...(data.deliveryCompany !== undefined && { deliveryCompany: data.deliveryCompany }),
        ...(data.scheduledDeliveryDate !== undefined && {
          scheduledDeliveryDate: data.scheduledDeliveryDate ? new Date(data.scheduledDeliveryDate) : null,
        }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.lineItems && {
          subtotal,
          total: subtotal + Number(existing.taxTotal) + Number(existing.shippingTotal),
          lineItems: {
            deleteMany: {},
            create: data.lineItems.map((li: any) => ({
              title: li.title,
              sku: li.sku ?? null,
              variantTitle: li.variantTitle ?? null,
              quantity: li.quantity,
              price: li.price,
              fulfilledQty: 0,
              refundedQty: 0,
            })),
          },
        }),
      },
      include: { lineItems: true },
    });

    await this.prisma.orderEvent.create({
      data: {
        orderId,
        eventType: 'order_edited',
        payload: { fields: Object.keys(data) },
        actor: actorId,
      },
    });

    return updated;
  }

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    actorId: string,
    extra?: { reason?: string; note?: string },
  ) {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: status,
        ...(extra?.reason && { cancellationReason: extra.reason }),
        ...(extra?.note && { cancellationNote: extra.note }),
      },
    });

    await this.prisma.orderEvent.create({
      data: {
        orderId,
        eventType: 'status_changed',
        payload: { to: status, reason: extra?.reason },
        actor: actorId,
      },
    });

    return order;
  }

  async updateCallAttempts(orderId: string, callAttempts: any[]) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { callAttempts },
    });
  }

  async updateTags(orderId: string, tags: string[], actorId: string) {
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { tags },
    });

    await this.prisma.orderEvent.create({
      data: {
        orderId,
        eventType: 'tags_updated',
        payload: { tags },
        actor: actorId,
      },
    });

    return updated;
  }

  async bulkUpdateStatus(orderIds: string[], status: OrderStatus, actorId: string) {
    await this.prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { orderStatus: status },
    });

    await this.prisma.orderEvent.createMany({
      data: orderIds.map((orderId) => ({
        orderId,
        eventType: 'status_changed',
        payload: { to: status },
        actor: actorId,
      })),
    });

    return { updated: orderIds.length };
  }

  async refund(orderId: string, amount: number, reason: string, actorId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');

    const totalRefunded = Number(order.totalRefunded) + amount;
    const financialStatus: FinancialStatus =
      totalRefunded >= Number(order.total) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const [updatedOrder, refund] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { totalRefunded, financialStatus },
      }),
      this.prisma.refund.create({
        data: { orderId, amount, reason },
      }),
    ]);

    await this.prisma.orderEvent.create({
      data: {
        orderId,
        eventType: 'refund_issued',
        payload: { amount, reason },
        actor: actorId,
      },
    });

    return { order: updatedOrder, refund };
  }
  async detectFromMessage(conversationText: string) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { error: 'No API key', confidence: 0 };
  
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Extract order info from this conversation. Reply ONLY with valid JSON, no markdown:
  {"customerName":"string or null","customerPhone":"string or null","city":"string or null","address":"string or null","products":[{"title":"string","quantity":1,"price":0}],"confidence":0.9}
  
  Conversation:
  ${conversationText}`,
          },
        ],
      }),
    });
  
    const raw = await response.json() as any;
    
    // Return raw for debugging
    if (!raw.content) return { debug: raw, confidence: 0 };
    
    const text = raw.content[0]?.text ?? '{}';
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      return JSON.parse(clean);
    } catch {
      return { debug: text, confidence: 0 };
    }
  }}