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
    // Extract phone numbers
    const phoneMatch = conversationText.match(/(\+?216\s?[\d\s]{8,}|\b[2459]\d{7}\b)/);
    const customerPhone = phoneMatch ? phoneMatch[0].replace(/\s/g, '') : null;
  
    // Extract name - look for patterns like "Name Surname" or after keywords
    const namePatterns = [
      /(?:je suis|mon nom est|name:|nom:?)\s*([A-Za-zÀ-ÿ]+\s+[A-Za-zÀ-ÿ]+)/i,
      /([A-Z][a-zÀ-ÿ]+\s+[A-Z][a-zÀ-ÿ]+)/,
    ];
    let customerName: string | null = null;
    for (const p of namePatterns) {
      const m = conversationText.match(p);
      if (m) { customerName = m[1].trim(); break; }
    }
  
    // Extract city
    const cities = ['Tunis', 'Sfax', 'Sousse', 'Bizerte', 'Nabeul', 'Monastir', 'Mahdia', 'Gafsa', 'Kairouan', 'Gabes', 'Ariana', 'Ben Arous', 'Manouba', 'Zaghouan', 'La Marsa', 'Carthage', 'Hammamet'];
    const city = cities.find(c => conversationText.toLowerCase().includes(c.toLowerCase())) ?? null;
  
    // Extract products - "N product" patterns
    const products: any[] = [];
    const productRegex = /(\d+)\s+([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s]{2,25})/g;
    let match;
    while ((match = productRegex.exec(conversationText)) !== null) {
      const qty = parseInt(match[1]);
      const title = match[2].trim();
      if (qty > 0 && qty < 50 && !['sur', 'de', 'le', 'la', 'les', 'un', 'une'].includes(title.toLowerCase())) {
        products.push({ title, quantity: qty, price: 0 });
      }
    }
  
    // Extract price
    const priceMatch = conversationText.match(/(\d+)\s*(?:TND|DT|dinars?)/i);
    if (priceMatch && products.length > 0) {
      products[0].price = parseInt(priceMatch[1]);
    }
  
    const confidence =
      (customerName ? 0.35 : 0) +
      (customerPhone ? 0.35 : 0) +
      (products.length > 0 ? 0.3 : 0);
  
    return {
      customerName,
      customerPhone,
      city,
      address: null,
      products: products.slice(0, 5),
      confidence,
    };
  }}