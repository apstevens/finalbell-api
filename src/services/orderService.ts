import { PrismaClient, OrderStatus, OrderSource, Order, OrderItem } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateOrderData {
  // User Information (NULL for guest orders)
  userId?: string | null;
  orderType?: 'authenticated' | 'guest';

  // Customer Information (always required)
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string;

  // Guest Information (NULL for authenticated orders)
  guestEmail?: string | null;

  // Shipping Address
  shippingStreet: string;
  shippingCity: string;
  shippingPostcode: string;
  shippingCountry?: string;

  // Billing Address (optional)
  billingStreet?: string;
  billingCity?: string;
  billingPostcode?: string;
  billingCountry?: string;

  // Order Details
  source: OrderSource;
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  currency?: string;

  // Payment Information
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: Date;

  // Order Items
  items: {
    productId: string;
    productName: string;
    variantName?: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    weight?: number;
    imageUrl?: string;
  }[];
}

export interface UpdateOrderStatusData {
  status: OrderStatus;
  notes?: string;
  createdBy?: string;
  supplierOrderId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
}

export interface OrderFilters {
  status?: OrderStatus;
  customerEmail?: string;
  orderNumber?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

class OrderService {
  /**
   * Generate unique order number in format FB-YYYY-####
   */
  async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FB-${year}-`;

    // Get the last order for this year
    const lastOrder = await prisma.order.findFirst({
      where: {
        orderNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        orderNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastOrder) {
      const lastNumber = parseInt(lastOrder.orderNumber.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new order
   */
  async createOrder(data: CreateOrderData): Promise<Order & { items: OrderItem[] }> {
    const orderNumber = await this.generateOrderNumber();

    // Determine order type
    const isGuestOrder = !data.userId || data.orderType === 'guest';
    const orderType = isGuestOrder ? 'guest' : 'authenticated';

    const order = await prisma.order.create({
      data: {
        orderNumber,
        // User relationship (NULL for guest orders)
        userId: data.userId || null,
        orderType,
        // Customer information
        customerEmail: data.customerEmail,
        customerFirstName: data.customerFirstName,
        customerLastName: data.customerLastName,
        customerPhone: data.customerPhone,
        // Guest email (NULL for authenticated orders)
        guestEmail: isGuestOrder ? data.guestEmail || data.customerEmail : null,
        // Shipping address
        shippingStreet: data.shippingStreet,
        shippingCity: data.shippingCity,
        shippingPostcode: data.shippingPostcode,
        shippingCountry: data.shippingCountry || 'GB',
        // Billing address
        billingStreet: data.billingStreet,
        billingCity: data.billingCity,
        billingPostcode: data.billingPostcode,
        billingCountry: data.billingCountry,
        // Order details
        status: OrderStatus.PENDING,
        source: data.source,
        subtotal: data.subtotal,
        shippingCost: data.shippingCost,
        tax: data.tax,
        total: data.total,
        currency: data.currency || 'GBP',
        // Payment information
        stripeSessionId: data.stripeSessionId,
        stripePaymentIntentId: data.stripePaymentIntentId,
        paidAt: data.paidAt,
        // Order items
        items: {
          create: data.items,
        },
        // Status history
        statusHistory: {
          create: {
            status: OrderStatus.PENDING,
            notes: `Order created (${orderType})`,
          },
        },
      },
      include: {
        items: true,
        statusHistory: true,
      },
    });

    return order;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<Order & { items: OrderItem[] } | null> {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(orderNumber: string): Promise<Order & { items: OrderItem[] } | null> {
    return prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  /**
   * Get order by Stripe session ID
   */
  async getOrderByStripeSession(sessionId: string): Promise<Order | null> {
    return prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
      include: {
        items: true,
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  /**
   * Get orders with filters
   */
  async getOrders(filters: OrderFilters = {}): Promise<Order[]> {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.customerEmail) {
      where.customerEmail = {
        contains: filters.customerEmail,
        mode: 'insensitive',
      };
    }

    if (filters.orderNumber) {
      where.orderNumber = filters.orderNumber;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    return prisma.order.findMany({
      where,
      include: {
        items: true,
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });
  }

  /**
   * Get pending orders (status = PENDING or PROCESSING)
   */
  async getPendingOrders(): Promise<Order[]> {
    return prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PENDING, OrderStatus.PROCESSING],
        },
      },
      include: {
        items: true,
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    data: UpdateOrderStatusData
  ): Promise<Order & { items: OrderItem[] }> {
    const updateData: any = {
      status: data.status,
    };

    // Set timestamps based on status
    if (data.status === OrderStatus.SHIPPED && !data.trackingNumber) {
      throw new Error('Tracking number is required when marking order as shipped');
    }

    if (data.status === OrderStatus.SHIPPED) {
      updateData.shippedAt = new Date();
      updateData.trackingNumber = data.trackingNumber;
      updateData.trackingUrl = data.trackingUrl;
      updateData.carrier = data.carrier;
    }

    if (data.status === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    }

    if (data.supplierOrderId) {
      updateData.supplierOrderId = data.supplierOrderId;
    }

    // Update order and create status history entry
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...updateData,
        statusHistory: {
          create: {
            status: data.status,
            notes: data.notes,
            createdBy: data.createdBy,
          },
        },
      },
      include: {
        items: true,
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    return order;
  }

  /**
   * Add internal notes to order
   */
  async addInternalNotes(orderId: string, notes: string): Promise<Order> {
    return prisma.order.update({
      where: { id: orderId },
      data: { internalNotes: notes },
    });
  }

  /**
   * Cancel order
   */
  async cancelOrder(
    orderId: string,
    reason: string,
    cancelledBy?: string
  ): Promise<Order> {
    return prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancellationReason: reason,
        statusHistory: {
          create: {
            status: OrderStatus.CANCELLED,
            notes: reason,
            createdBy: cancelledBy,
          },
        },
      },
      include: {
        items: true,
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  /**
   * Get order statistics
   */
  async getOrderStats(dateFrom?: Date, dateTo?: Date) {
    const where: any = {};

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue,
    ] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.count({ where: { ...where, status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { ...where, status: OrderStatus.PROCESSING } }),
      prisma.order.count({ where: { ...where, status: OrderStatus.SHIPPED } }),
      prisma.order.count({ where: { ...where, status: OrderStatus.DELIVERED } }),
      prisma.order.count({ where: { ...where, status: OrderStatus.CANCELLED } }),
      prisma.order.aggregate({
        where: {
          ...where,
          status: {
            notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED],
          },
        },
        _sum: {
          total: true,
        },
      }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue: totalRevenue._sum.total || 0,
    };
  }

  /**
   * Search orders by customer email or order number
   */
  async searchOrders(query: string): Promise<Order[]> {
    return prisma.order.findMany({
      where: {
        OR: [
          {
            orderNumber: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            customerEmail: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            customerFirstName: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            customerLastName: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        items: true,
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });
  }

  /**
   * Track guest order by email and order number
   */
  async trackGuestOrder(email: string, orderNumber: string): Promise<Order & { items: OrderItem[] } | null> {
    return prisma.order.findFirst({
      where: {
        orderNumber: {
          equals: orderNumber,
          mode: 'insensitive',
        },
        OR: [
          { guestEmail: email },
          { customerEmail: email },
        ],
      },
      include: {
        items: true,
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }
}

export default new OrderService();
