export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  MERCHANT = 'MERCHANT',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export enum OrderStatus {
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SEARCHING_DRIVER = 'SEARCHING_DRIVER',
  ASSIGNED = 'ASSIGNED',
  PREPARING = 'PREPARING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  PICKING_UP = 'PICKING_UP',
  ON_THE_WAY = 'ON_THE_WAY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  YAPE_MANUAL = 'YAPE_MANUAL',
  PLIN_MANUAL = 'PLIN_MANUAL',
  MERCADO_PAGO = 'MERCADO_PAGO',
  YAPE = 'YAPE',
  PLIN = 'PLIN',
  CASH = 'CASH',
  CARD = 'CARD',
}

export enum PaymentStatus {
  PAYMENT_PENDING_VERIFICATION = 'PAYMENT_PENDING_VERIFICATION',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PAID = 'PAID',
}

export enum DriverStatus {
  OFFLINE = 'OFFLINE',
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  BUSY = 'BUSY',
  SUSPENDED = 'SUSPENDED',
}

export enum AssignmentStatus {
  OFFERED = 'OFFERED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  COMPLETED = 'COMPLETED',
}

export type JwtPayload = {
  sub: string;
  role: UserRole;
  email?: string;
  iat?: number;
  exp?: number;
  authVersion?: number;
};

export type OrderType = 'MARKETPLACE' | 'PERSONAL_SHIPMENT';
export type LegalType = 'GENERAL_TERMS' | 'PRIVACY_POLICY' | 'SHIPPING_TERMS' | 'PROHIBITED_ITEMS_POLICY' | 'DRIVER_TERMS' | 'MERCHANT_TERMS';
export type PublicPerson = { displayName: string; avatar: string | null };
export type PublicDriver = PublicPerson & { rating: number; vehicleType: string; vehiclePlate: string | null };

export type EventEnvelope<T = Record<string, unknown>> = {
  id: string;
  name: string;
  version: number;
  occurredAt: string;
  correlationId: string;
  payload: T;
};

export type DriverLocation = {
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  timestamp: string;
};

export type ApiError = {
  statusCode: number;
  code: string;
  message: string;
  correlationId: string;
};
