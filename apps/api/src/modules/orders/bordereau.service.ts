import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as QRCode from 'qrcode';

@Injectable()
export class BordereauService {
  constructor(private prisma: PrismaService) {}

  async generateBordereau(orderId: string): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lineItems: true,
        store: { select: { name: true } },
      },
    });

    if (!order) throw new Error('Order not found');

    const qrData = JSON.stringify({
      orderId: order.id,
      orderNumber: order.orderNumber,
      storeId: order.storeId,
    });

    const qrCodeBase64 = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 1,
    });

    const shippingAddress = order.shippingAddress as any;
    // Exchange info
    let exchangeHtml = '';
    if (order.internalNote) {
      try {
        const meta = JSON.parse(order.internalNote);
        if (meta.exchange?.itemsToRecover?.length) {
          const items = meta.exchange.itemsToRecover
            .map((i: any) => `${i.title}${i.variantTitle ? ' - ' + i.variantTitle : ''} x ${i.quantity}`)
            .join(' / ');
          exchangeHtml = [
            '<div style="border:3px solid #000;background:#f5f5f5;padding:12px;margin-bottom:15px;">',
            '<p style="font-size:14px;font-weight:bold;margin-bottom:6px;">*** ECHANGE - PRODUIT A RECUPERER ***</p>',
            '<p style="font-size:13px;font-weight:bold;">' + items + '</p>',
            '<p style="font-size:11px;margin-top:6px;">Commande origine: ' + (meta.exchange.originalOrderNumber ?? '-') + '</p>',
            '<p style="font-size:11px;">Raison: ' + (meta.exchange.reason ?? '-') + '</p>',
            '</div>',
          ].join('');
        }
      } catch {}
    }

    const lineItemsHtml = order.lineItems.map((li) => {
      const price = (Number(li.price) * li.quantity).toFixed(3);
      const title = li.title + (li.variantTitle ? ' - ' + li.variantTitle : '');
      return [
        '<div class="product-row">',
        '<span class="product-name">' + title + '</span>',
        '<span class="product-qty">x ' + li.quantity + '</span>',
        '<span class="product-price">' + price + ' ' + order.currency + '</span>',
        '</div>',
      ].join('');
    }).join('');

    const addressHtml = shippingAddress ? [
      '<br><br>',
      '<span style="font-size:12px;">',
      (shippingAddress.address1 ?? '') + '<br>',
      (shippingAddress.city ?? '') + ' ' + (shippingAddress.province ?? '') + '<br>',
      (shippingAddress.country ?? ''),
      '</span>',
    ].join('') : '';

    const notesHtml = order.notes ? [
      '<div style="border:1px solid #ddd;border-radius:4px;padding:10px;margin-bottom:15px;">',
      '<p style="font-size:11px;text-transform:uppercase;color:#666;margin-bottom:4px;">Note</p>',
      '<p style="font-size:12px;">' + order.notes + '</p>',
      '</div>',
    ].join('') : '';

    const html = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      '<style>',
      '* { margin: 0; padding: 0; box-sizing: border-box; }',
      'body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }',
      '.bordereau { width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; }',
      '.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px; }',
      '.logo { font-size: 24px; font-weight: bold; }',
      '.order-number { font-size: 20px; font-weight: bold; text-align: right; }',
      '.qr-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }',
      '.client-info { flex: 1; }',
      '.client-info h3 { font-size: 11px; text-transform: uppercase; color: #666; margin-bottom: 8px; }',
      '.client-info p { font-size: 13px; font-weight: bold; margin-bottom: 4px; }',
      '.client-info span { font-size: 12px; color: #333; }',
      '.qr-code { text-align: center; }',
      '.qr-code img { width: 120px; height: 120px; }',
      '.qr-code p { font-size: 10px; color: #666; margin-top: 4px; }',
      '.products { border: 1px solid #ddd; border-radius: 4px; margin-bottom: 15px; }',
      '.products h3 { font-size: 11px; text-transform: uppercase; color: #666; padding: 8px 12px; border-bottom: 1px solid #ddd; background: #f9f9f9; }',
      '.product-row { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #eee; }',
      '.product-row:last-child { border-bottom: none; }',
      '.product-name { flex: 1; font-size: 12px; }',
      '.product-qty { font-size: 12px; color: #666; margin: 0 15px; }',
      '.product-price { font-size: 12px; font-weight: bold; }',
      '.total-section { background: #f0f0f0; border-radius: 4px; padding: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }',
      '.total-label { font-size: 14px; font-weight: bold; }',
      '.total-amount { font-size: 22px; font-weight: bold; color: #000; }',
      '.footer { border-top: 1px solid #ddd; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #666; }',
      '.badge { display: inline-block; background: #000; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }',
      '.divider { border: none; border-top: 1px dashed #ccc; margin: 15px 0; }',
      '</style>',
      '</head>',
      '<body>',
      '<div class="bordereau">',

      '<div class="header">',
      '<div>',
      '<div class="logo">Orderly</div>',
      '<p style="font-size:11px;color:#666;margin-top:4px;">' + order.store.name + '</p>',
      '<span class="badge">Bordereau d expedition</span>',
      '</div>',
      '<div class="order-number">',
      '<p>' + order.orderNumber + '</p>',
      '<p style="font-size:12px;font-weight:normal;color:#666;margin-top:4px;">' + new Date(order.sourceCreatedAt).toLocaleDateString('fr-FR') + '</p>',
      '</div>',
      '</div>',

      '<div class="qr-section">',
      '<div class="client-info">',
      '<h3>Informations client</h3>',
      '<p>' + (order.customerName ?? '-') + '</p>',
      '<span>' + (order.customerPhone ?? '-') + '</span>',
      addressHtml,
      '</div>',
      '<div class="qr-code">',
      '<img src="' + qrCodeBase64 + '" alt="QR Code" />',
      '<p>Scanner pour mise a jour statut</p>',
      '<p style="font-weight:bold;margin-top:4px;">' + order.orderNumber + '</p>',
      '</div>',
      '</div>',

      '<hr class="divider" />',

      exchangeHtml,

      '<div class="products">',
      '<h3>Articles commandes</h3>',
      lineItemsHtml,
      '</div>',

      '<div class="total-section">',
      '<span class="total-label">Montant a encaisser (COD)</span>',
      '<span class="total-amount">' + Number(order.total).toFixed(3) + ' ' + order.currency + '</span>',
      '</div>',

      notesHtml,

      '<div class="footer">',
      '<span>Genere le ' + new Date().toLocaleString('fr-FR') + '</span>',
      '<span>ID: ' + order.id + '</span>',
      '<span>' + order.store.name + '</span>',
      '</div>',

      '</div>',
      '</body>',
      '</html>',
    ].join('\n');

    return Buffer.from(html, 'utf-8');
  }
}