import seedrandom from 'seedrandom';

export interface DatasetRecord {
  customer_id: string;
  email: string;
  phone: string;
  order_date: string;
  product_review: string;
  customer_comment: string;
  support_ticket: string;
  loyalty_status: string;
  last_purchase_amount: number;
}

export interface Dataset {
  metadata: {
    recordCount: number;
    filename: string;
    seed: number;
    generatedAt: string;
  };
  headers: string[];
  records: DatasetRecord[];
}

export class ComprehensiveDataGenerator {
  private rng: seedrandom.PRNG;
  private seed: number;
  private customerPool: string[] = [];
  private customerOrderHistory: Map<string, Date[]> = new Map();

  constructor(seed: number = Date.now()) {
    this.seed = seed;
    this.rng = seedrandom(seed.toString());
  }

  generateEcommerceStandardDataset(): Dataset {
    const records: DatasetRecord[] = [];
    const recordCount = 10000;
    
    // Initialize customer pool with some customers (about 3000 unique customers for 10000 orders)
    const uniqueCustomerCount = 3000;
    for (let i = 0; i < uniqueCustomerCount; i++) {
      this.customerPool.push(`CUST-${String(i + 1).padStart(5, '0')}`);
    }

    for (let i = 0; i < recordCount; i++) {
      records.push(this.generateEcommerceRecord(i));
    }

    return {
      metadata: {
        recordCount,
        filename: 'test_ecommerce_standard_10k.csv',
        seed: this.seed,
        generatedAt: new Date('2024-06-23T00:00:00.000Z').toISOString()
      },
      headers: [
        'customer_id',
        'email',
        'phone',
        'order_date',
        'product_review',
        'customer_comment',
        'support_ticket',
        'loyalty_status',
        'last_purchase_amount'
      ],
      records
    };
  }

  private generateEcommerceRecord(index: number): DatasetRecord {
    // Select customer - 70% chance of existing customer, 30% sequential assignment
    let customerId: string;
    let customerIndex: number;
    
    if (this.rng() < 0.7 && this.customerOrderHistory.size > 0) {
      // Pick from existing customers
      customerIndex = this.randomInt(0, Math.min(this.customerOrderHistory.size - 1, this.customerPool.length - 1));
      customerId = this.customerPool[customerIndex];
    } else {
      // Use sequential customer assignment
      customerIndex = Math.min(index, this.customerPool.length - 1);
      customerId = this.customerPool[customerIndex];
    }
    
    // Generate order date considering customer history
    const orderDate = this.generateOrderDateForCustomer(customerId);
    
    // Extract customer number for email
    const customerNum = parseInt(customerId.replace('CUST-', ''));
    
    return {
      customer_id: customerId,
      email: `test.user${customerNum}@example.com`,
      phone: `(555) ${this.randomInt(100, 999)}-${String(this.randomInt(1000, 9999)).padStart(4, '0')}`,
      order_date: orderDate.toISOString(),
      product_review: this.generateProductReview(),
      customer_comment: this.generateCustomerComment(),
      support_ticket: this.generateSupportTicket(),
      loyalty_status: this.generateLoyaltyStatus(),
      last_purchase_amount: this.generatePurchaseAmount()
    };
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  private generateOrderDate(): string {
    const daysAgo = this.randomInt(0, 540); // Last 18 months
    const baseDate = new Date('2024-06-23T00:00:00.000Z'); // Fixed base date for reproducibility
    baseDate.setDate(baseDate.getDate() - daysAgo);
    return baseDate.toISOString();
  }

  private generateOrderDateForCustomer(customerId: string): Date {
    const baseDate = new Date('2024-06-23T00:00:00.000Z');
    
    // Get customer's order history
    if (!this.customerOrderHistory.has(customerId)) {
      this.customerOrderHistory.set(customerId, []);
    }
    
    const history = this.customerOrderHistory.get(customerId)!;
    
    if (history.length === 0) {
      // First order - random date in the past 18 months
      const daysAgo = this.randomInt(30, 540);
      const orderDate = new Date(baseDate);
      orderDate.setDate(orderDate.getDate() - daysAgo);
      history.push(orderDate);
      return orderDate;
    } else {
      // Subsequent order - must be after the last order
      const lastOrder = history[history.length - 1];
      const daysSinceLastOrder = Math.floor((baseDate.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastOrder <= 1) {
        // If last order was very recent, use current date
        return new Date(baseDate);
      }
      
      // Random date between last order and now
      const daysAfterLastOrder = this.randomInt(1, Math.max(1, daysSinceLastOrder - 1));
      const orderDate = new Date(lastOrder);
      orderDate.setDate(orderDate.getDate() + daysAfterLastOrder);
      history.push(orderDate);
      return orderDate;
    }
  }

  private generateProductReview(): string {
    if (this.rng() > 0.7) return ''; // 30% empty
    
    const reviews = [
      'Great product, exactly what I was looking for!',
      'Quality is okay but shipping took too long.',
      'Terrible experience, product broke after one day.',
      'Amazing value for money, will buy again!',
      'Not as described, very disappointed.'
    ];
    
    return reviews[this.randomInt(0, reviews.length - 1)];
  }

  private generateCustomerComment(): string {
    if (this.rng() > 0.4) return ''; // 60% empty
    
    const comments = [
      'Please improve your customer service.',
      'Love your products, keep up the good work!',
      'Had issues with my last order.',
      'Best online shopping experience ever!',
      'Need better product descriptions.'
    ];
    
    return comments[this.randomInt(0, comments.length - 1)];
  }

  private generateSupportTicket(): string {
    if (this.rng() > 0.2) return ''; // 80% empty
    
    const tickets = [
      'Order not received',
      'Product defect',
      'Wrong item shipped',
      'Refund request',
      'Technical issue with website'
    ];
    
    return tickets[this.randomInt(0, tickets.length - 1)];
  }

  private generateLoyaltyStatus(): string {
    const rand = this.rng();
    if (rand < 0.2) return 'Platinum';
    if (rand < 0.5) return 'Gold';
    return 'Silver';
  }

  private generatePurchaseAmount(): number {
    // Log-normal distribution between $10 and $1000
    const logMin = Math.log(10);
    const logMax = Math.log(1000);
    const logValue = logMin + this.rng() * (logMax - logMin);
    return Math.round(Math.exp(logValue) * 100) / 100;
  }
}