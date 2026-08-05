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
        orderStatus: data.orderStatus ?? 'NOUVEAU',
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
        deliveryCompany: data.deliveryCompany ?? null,
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
  async getOrderEvents(orderId: string) {
    const events = await this.prisma.orderEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  
    // Resolve actor names
    const actorIds = [...new Set(events.map((e) => e.actor).filter(Boolean))] as string[];
    const users = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  
    return events.map((e) => ({
      ...e,
      actorName: e.actor ? (userMap[e.actor]?.name ?? e.actor) : 'Système',
      actorEmail: e.actor ? userMap[e.actor]?.email : null,
    }));
  }
  async createExchange(
    originalOrderId: string,
    data: {
      itemsToRecover: { title: string; sku?: string; variantTitle?: string; quantity: number }[];
      itemsToSend: { title: string; sku?: string; variantTitle?: string; quantity: number; price?: number }[];
      priceDifference?: number;
      reason: string;
      deliveryCompany?: string;
    },
    actorId: string,
  ) {
    const original = await this.prisma.order.findUnique({
      where: { id: originalOrderId },
      include: { lineItems: true },
    });
    if (!original) throw new Error('Original order not found');
  
    const diff = data.priceDifference ?? 0;
    const exchangeNumber = `#E-${original.orderNumber.replace('#', '')}`;
  
    // Store exchange metadata in internalNote as JSON
    const exchangeMeta = {
      exchange: {
        originalOrderId,
        originalOrderNumber: original.orderNumber,
        itemsToRecover: data.itemsToRecover,
        reason: data.reason,
        createdAt: new Date().toISOString(),
      },
    };
  
    const exchangeOrder = await this.prisma.order.create({
      data: {
        storeId: original.storeId,
        externalOrderId: `exchange_${Date.now()}`,
        orderNumber: exchangeNumber,
        financialStatus: 'PENDING',
        fulfillmentStatus: 'UNFULFILLED',
        orderStatus: 'ECHANGE',
        customerName: original.customerName,
        customerPhone: original.customerPhone,
        customerPhone2: original.customerPhone2,
        customerEmail: original.customerEmail,
        shippingAddress: original.shippingAddress ?? undefined,
        currency: original.currency,
        subtotal: diff,
        taxTotal: 0,
        shippingTotal: 0,
        total: diff,
        totalRefunded: 0,
        tags: ['Échange'],
        internalNote: JSON.stringify(exchangeMeta),
        deliveryCompany: data.deliveryCompany ?? original.deliveryCompany,
        sourceCreatedAt: new Date(),
        lineItems: {
          create: data.itemsToSend.map((li) => ({
            title: li.title,
            sku: li.sku ?? null,
            variantTitle: li.variantTitle ?? null,
            quantity: li.quantity,
            price: li.price ?? 0,
            fulfilledQty: 0,
            refundedQty: 0,
          })),
        },
      },
      include: { lineItems: true },
    });
  
    // Tag original order
    const originalTags = original.tags.includes('Échange')
      ? original.tags
      : [...original.tags, 'Échange'];
  
    await this.prisma.order.update({
      where: { id: originalOrderId },
      data: { tags: originalTags },
    });
  
    await this.prisma.orderEvent.create({
      data: {
        orderId: exchangeOrder.id,
        eventType: 'exchange_created',
        payload: {
          originalOrderNumber: original.orderNumber,
          reason: data.reason,
          priceDifference: diff,
        },
        actor: actorId,
      },
    });
  
    await this.prisma.orderEvent.create({
      data: {
        orderId: originalOrderId,
        eventType: 'exchange_requested',
        payload: {
          exchangeOrderNumber: exchangeNumber,
          reason: data.reason,
        },
        actor: actorId,
      },
    });
  
    return exchangeOrder;
  }
  
  // Restock recovered items when exchange is delivered
  async restockExchangeItems(orderId: string, actorId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order?.internalNote) return { restocked: 0 };
  
    let meta: any = {};
    try { meta = JSON.parse(order.internalNote); } catch { return { restocked: 0 }; }
    if (!meta.exchange?.itemsToRecover) return { restocked: 0 };
  
    let restocked = 0;
    for (const item of meta.exchange.itemsToRecover) {
      if (!item.sku) continue;
      const product = await this.prisma.product.findUnique({
        where: { storeId_sku: { storeId: order.storeId, sku: item.sku } },
      });
      if (!product) continue;
  
      const before = product.quantityAvailable;
      const after = before + item.quantity;
  
      await this.prisma.product.update({
        where: { id: product.id },
        data: { quantityAvailable: after },
      });
  
      await this.prisma.inventoryLog.create({
        data: {
          productId: product.id,
          type: 'EXCHANGE_RETURN',
          quantityChange: item.quantity,
          quantityBefore: before,
          quantityAfter: after,
          note: `Retour échange — commande ${order.orderNumber}`,
          actor: actorId,
        },
      });
      restocked++;
    }
  
    return { restocked };
  }
  async detectLoyalCustomers() {
    const TAG = 'Client fidèle';
    const SIX_HOURS = 6 * 60 * 60 * 1000;
  
    // Get all orders with a phone, sorted by date
    const orders = await this.prisma.order.findMany({
      where: { customerPhone: { not: null } },
      select: {
        id: true,
        customerPhone: true,
        sourceCreatedAt: true,
        tags: true,
        orderStatus: true,
      },
      orderBy: { sourceCreatedAt: 'asc' },
    });
  
    // Group by phone
    const byPhone: Record<string, typeof orders> = {};
    for (const o of orders) {
      const phone = (o.customerPhone ?? '').replace(/\s|\+216/g, '');
      if (!phone || phone.length < 6) continue;
      if (!byPhone[phone]) byPhone[phone] = [];
      byPhone[phone].push(o);
    }
  
    const toTag: string[] = [];
    const toUntag: string[] = [];
  
    for (const phone of Object.keys(byPhone)) {
      const list = byPhone[phone];
      // Ignore cancelled/archived when counting real orders
      const valid = list.filter(
        (o) => o.orderStatus !== 'ANNULE' && o.orderStatus !== 'ARCHIVE',
      );
  
      if (valid.length < 2) {
        // Not loyal — remove tag if present
        list.forEach((o) => {
          if (o.tags.includes(TAG)) toUntag.push(o.id);
        });
        continue;
      }
  
      const first = new Date(valid[0].sourceCreatedAt).getTime();
  
      // Find orders placed at least 6h after the first one
      const loyal = valid.filter(
        (o) => new Date(o.sourceCreatedAt).getTime() - first >= SIX_HOURS,
      );
  
      if (loyal.length === 0) {
        // All orders within 6h — likely a duplicate, not loyal
        list.forEach((o) => {
          if (o.tags.includes(TAG)) toUntag.push(o.id);
        });
        continue;
      }
  
      // Tag ALL orders of this customer (first one included)
      valid.forEach((o) => {
        if (!o.tags.includes(TAG)) toTag.push(o.id);
      });
    }
  
    // Apply — add tag
    for (const id of toTag) {
      const order = orders.find((o) => o.id === id);
      if (!order) continue;
      await this.prisma.order.update({
        where: { id },
        data: { tags: { set: [...order.tags, TAG] } },
      });
    }
  
    // Apply — remove tag
    for (const id of toUntag) {
      const order = orders.find((o) => o.id === id);
      if (!order) continue;
      await this.prisma.order.update({
        where: { id },
        data: { tags: { set: order.tags.filter((t) => t !== TAG) } },
      });
    }
  
    return {
      tagged: toTag.length,
      untagged: toUntag.length,
      loyalCustomers: Object.keys(byPhone).filter((p) => {
        const valid = byPhone[p].filter(
          (o) => o.orderStatus !== 'ANNULE' && o.orderStatus !== 'ARCHIVE',
        );
        if (valid.length < 2) return false;
        const first = new Date(valid[0].sourceCreatedAt).getTime();
        return valid.some(
          (o) => new Date(o.sourceCreatedAt).getTime() - first >= SIX_HOURS,
        );
      }).length,
    };
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