import nodemailer from 'nodemailer';
import { Order, OrderItem, OrderStatus } from '@prisma/client';
import { env } from '../config/env';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Check if SMTP credentials are configured
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
      console.warn('[Email Service] SMTP not configured - emails will be logged only');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
      });

      console.log('[Email Service] SMTP transporter initialized');
    } catch (error) {
      console.error('[Email Service] Failed to initialize SMTP transporter:', error);
    }
  }

  private async sendEmail(options: EmailOptions): Promise<boolean> {
    // If no transporter, just log the email
    if (!this.transporter) {
      console.log('[Email Service] Would send email (SMTP not configured):');
      console.log(`  To: ${options.to}`);
      console.log(`  Subject: ${options.subject}`);
      console.log(`  Body: ${options.text || options.html.substring(0, 100)}...`);
      return true;
    }

    try {
      const from = env.EMAIL_FROM || 'Final Bell <noreply@finalbell.co.uk>';

      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      console.log(`[Email Service] Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      console.error('[Email Service] Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send order confirmation email to customer
   */
  async sendOrderConfirmation(order: Order & { items: OrderItem[] }): Promise<boolean> {
    const itemsHtml = order.items
      .map(
        (item) => `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              ${item.productName}${item.variantName ? ` - ${item.variantName}` : ''}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              ${item.quantity}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">
              £${item.unitPrice.toFixed(2)}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">
              £${item.totalPrice.toFixed(2)}
            </td>
          </tr>
        `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation - Final Bell</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background-color: #1f2937; padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Final Bell</h1>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #1f2937; margin-top: 0;">Order Confirmation</h2>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                      Hi ${order.customerFirstName},
                    </p>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                      Thank you for your order! We've received your payment and will process your order shortly.
                    </p>

                    <!-- Order Details -->
                    <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
                      <p style="margin: 5px 0; color: #1f2937; font-weight: bold;">
                        Order Number: ${order.orderNumber}
                      </p>
                      <p style="margin: 5px 0; color: #4b5563;">
                        Order Date: ${order.createdAt.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>

                    <!-- Order Items -->
                    <h3 style="color: #1f2937; margin-top: 30px;">Order Items</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                      <thead>
                        <tr style="background-color: #f9fafb;">
                          <th style="padding: 10px; text-align: left; color: #1f2937;">Product</th>
                          <th style="padding: 10px; text-align: center; color: #1f2937;">Qty</th>
                          <th style="padding: 10px; text-align: right; color: #1f2937;">Price</th>
                          <th style="padding: 10px; text-align: right; color: #1f2937;">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsHtml}
                      </tbody>
                    </table>

                    <!-- Order Totals -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                      <tr>
                        <td style="padding: 5px 0; text-align: right; color: #4b5563;">Subtotal:</td>
                        <td style="padding: 5px 0 5px 20px; text-align: right; color: #1f2937; width: 100px;">
                          £${order.subtotal.toFixed(2)}
                        </td>
                      </tr>
                      ${order.shippingCost > 0 ? `
                      <tr>
                        <td style="padding: 5px 0; text-align: right; color: #4b5563;">Shipping:</td>
                        <td style="padding: 5px 0 5px 20px; text-align: right; color: #1f2937;">
                          £${order.shippingCost.toFixed(2)}
                        </td>
                      </tr>
                      ` : ''}
                      ${order.tax > 0 ? `
                      <tr>
                        <td style="padding: 5px 0; text-align: right; color: #4b5563;">Tax:</td>
                        <td style="padding: 5px 0 5px 20px; text-align: right; color: #1f2937;">
                          £${order.tax.toFixed(2)}
                        </td>
                      </tr>
                      ` : ''}
                      <tr style="border-top: 2px solid #1f2937;">
                        <td style="padding: 10px 0; text-align: right; color: #1f2937; font-weight: bold; font-size: 18px;">
                          Total:
                        </td>
                        <td style="padding: 10px 0 10px 20px; text-align: right; color: #1f2937; font-weight: bold; font-size: 18px;">
                          £${order.total.toFixed(2)}
                        </td>
                      </tr>
                    </table>

                    <!-- Shipping Address -->
                    <h3 style="color: #1f2937; margin-top: 30px;">Shipping Address</h3>
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px;">
                      <p style="margin: 2px 0; color: #1f2937;">${order.customerFirstName} ${order.customerLastName}</p>
                      <p style="margin: 2px 0; color: #4b5563;">${order.shippingStreet}</p>
                      <p style="margin: 2px 0; color: #4b5563;">${order.shippingCity}, ${order.shippingPostcode}</p>
                      <p style="margin: 2px 0; color: #4b5563;">${order.shippingCountry}</p>
                    </div>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-top: 30px;">
                      We'll send you another email once your order has been shipped with tracking information.
                    </p>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                      If you have any questions, please don't hesitate to contact us.
                    </p>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                      Best regards,<br>
                      The Final Bell Team
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      © ${new Date().getFullYear()} Final Bell. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `
Order Confirmation - Final Bell

Hi ${order.customerFirstName},

Thank you for your order! We've received your payment and will process your order shortly.

Order Number: ${order.orderNumber}
Order Date: ${order.createdAt.toLocaleDateString('en-GB')}

ORDER ITEMS:
${order.items.map(item => `${item.productName}${item.variantName ? ` - ${item.variantName}` : ''} x${item.quantity} - £${item.totalPrice.toFixed(2)}`).join('\n')}

Subtotal: £${order.subtotal.toFixed(2)}
${order.shippingCost > 0 ? `Shipping: £${order.shippingCost.toFixed(2)}\n` : ''}${order.tax > 0 ? `Tax: £${order.tax.toFixed(2)}\n` : ''}Total: £${order.total.toFixed(2)}

SHIPPING ADDRESS:
${order.customerFirstName} ${order.customerLastName}
${order.shippingStreet}
${order.shippingCity}, ${order.shippingPostcode}
${order.shippingCountry}

We'll send you another email once your order has been shipped with tracking information.

Best regards,
The Final Bell Team
    `.trim();

    return this.sendEmail({
      to: order.customerEmail,
      subject: `Order Confirmation - ${order.orderNumber}`,
      html,
      text,
    });
  }

  /**
   * Send shipping notification email to customer
   */
  async sendShippingNotification(order: Order & { items: OrderItem[] }): Promise<boolean> {
    const trackingHtml = order.trackingUrl
      ? `<p style="text-align: center; margin: 30px 0;">
           <a href="${order.trackingUrl}"
              style="display: inline-block; background-color: #1f2937; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
             Track Your Order
           </a>
         </p>`
      : order.trackingNumber
      ? `<p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
           Tracking Number: <strong>${order.trackingNumber}</strong>
         </p>`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Shipped - Final Bell</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background-color: #1f2937; padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Final Bell</h1>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #1f2937; margin-top: 0;">Your Order Has Been Shipped!</h2>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                      Hi ${order.customerFirstName},
                    </p>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                      Great news! Your order <strong>${order.orderNumber}</strong> has been shipped${order.carrier ? ` via ${order.carrier}` : ''} and is on its way to you.
                    </p>

                    ${trackingHtml}

                    <!-- Shipping Address -->
                    <h3 style="color: #1f2937; margin-top: 30px;">Shipping To:</h3>
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px;">
                      <p style="margin: 2px 0; color: #1f2937;">${order.customerFirstName} ${order.customerLastName}</p>
                      <p style="margin: 2px 0; color: #4b5563;">${order.shippingStreet}</p>
                      <p style="margin: 2px 0; color: #4b5563;">${order.shippingCity}, ${order.shippingPostcode}</p>
                      <p style="margin: 2px 0; color: #4b5563;">${order.shippingCountry}</p>
                    </div>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-top: 30px;">
                      Your order should arrive within 3-5 business days. If you have any questions about your order, please don't hesitate to contact us.
                    </p>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                      Thank you for shopping with Final Bell!
                    </p>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                      Best regards,<br>
                      The Final Bell Team
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      © ${new Date().getFullYear()} Final Bell. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `
Your Order Has Been Shipped! - Final Bell

Hi ${order.customerFirstName},

Great news! Your order ${order.orderNumber} has been shipped${order.carrier ? ` via ${order.carrier}` : ''} and is on its way to you.

${order.trackingNumber ? `Tracking Number: ${order.trackingNumber}` : ''}
${order.trackingUrl ? `Track your order: ${order.trackingUrl}` : ''}

SHIPPING TO:
${order.customerFirstName} ${order.customerLastName}
${order.shippingStreet}
${order.shippingCity}, ${order.shippingPostcode}
${order.shippingCountry}

Your order should arrive within 3-5 business days. If you have any questions about your order, please don't hesitate to contact us.

Thank you for shopping with Final Bell!

Best regards,
The Final Bell Team
    `.trim();

    return this.sendEmail({
      to: order.customerEmail,
      subject: `Your Order Has Been Shipped - ${order.orderNumber}`,
      html,
      text,
    });
  }

  /**
   * Send admin notification for new order
   */
  async sendAdminNewOrderNotification(order: Order & { items: OrderItem[] }): Promise<boolean> {
    const adminEmail = env.ADMIN_EMAIL || env.EMAIL_FROM;
    if (!adminEmail) {
      console.log('[Email Service] No admin email configured');
      return false;
    }

    const itemsText = order.items
      .map(item => `- ${item.productName}${item.variantName ? ` (${item.variantName})` : ''} x${item.quantity} - £${item.totalPrice.toFixed(2)}`)
      .join('\n');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Order Received</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #1f2937;">New Order Received</h2>

        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Customer:</strong> ${order.customerFirstName} ${order.customerLastName}</p>
        <p><strong>Email:</strong> ${order.customerEmail}</p>
        <p><strong>Total:</strong> £${order.total.toFixed(2)}</p>

        <h3>Items:</h3>
        <ul>
          ${order.items.map(item => `<li>${item.productName}${item.variantName ? ` (${item.variantName})` : ''} x${item.quantity} - £${item.totalPrice.toFixed(2)}</li>`).join('')}
        </ul>

        <h3>Shipping Address:</h3>
        <p>
          ${order.customerFirstName} ${order.customerLastName}<br>
          ${order.shippingStreet}<br>
          ${order.shippingCity}, ${order.shippingPostcode}<br>
          ${order.shippingCountry}
        </p>

        <p style="margin-top: 30px;">
          <strong>Action Required:</strong> Process this order and update the status in the admin panel.
        </p>
      </body>
      </html>
    `;

    const text = `
NEW ORDER RECEIVED

Order Number: ${order.orderNumber}
Customer: ${order.customerFirstName} ${order.customerLastName}
Email: ${order.customerEmail}
Total: £${order.total.toFixed(2)}

ITEMS:
${itemsText}

SHIPPING ADDRESS:
${order.customerFirstName} ${order.customerLastName}
${order.shippingStreet}
${order.shippingCity}, ${order.shippingPostcode}
${order.shippingCountry}

Action Required: Process this order and update the status in the admin panel.
    `.trim();

    return this.sendEmail({
      to: adminEmail,
      subject: `New Order: ${order.orderNumber} - £${order.total.toFixed(2)}`,
      html,
      text,
    });
  }
}

export default new EmailService();
