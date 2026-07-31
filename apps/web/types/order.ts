export type StoreSourceType = "SHOPIFY" | "CUSTOM" | "MARKETPLACE";
export type UserRole = "SUPER_ADMIN" | "STORE_MANAGER" | "STAFF";
export type FinancialStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "VOIDED";

export type FulfillmentStatus =
  | "UNFULFILLED"
  | "PARTIAL"
  | "FULFILLED"
  | "RESTOCKED"
  | "CANCELLED";

export type OrderStatus =
  | "NOUVEAU"
  | "CONFIRMATION_EN_COURS"
  | "CONFIRME"
  | "EN_PREPARATION"
  | "A_EXPEDIER"
  | "AU_DEPOT_LIVREUR"
  | "EN_COURS_DE_LIVRAISON"
  | "LIVRE"
  | "PAYE"
  | "RETOUR"
  | "RETOUR_DEPOT"
  | "RETOUR_RECU"
  | "ANNULE"
  | "A_VERIFIER";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NOUVEAU: "Nouveau",
  CONFIRMATION_EN_COURS: "Confirmation en cours",
  CONFIRME: "Confirmé",
  EN_PREPARATION: "En préparation",
  A_EXPEDIER: "À expédier",
  AU_DEPOT_LIVREUR: "Au dépôt livreur",
  EN_COURS_DE_LIVRAISON: "En cours de livraison",
  LIVRE: "Livré",
  PAYE: "Payé",
  RETOUR: "Retour",
  RETOUR_DEPOT: "Retour dépôt",
  RETOUR_RECU: "Retour reçu",
  ANNULE: "Annulé",
  A_VERIFIER: "À vérifier",
};

export interface CallAttempt {
  id: string;
  date: string;
  phone: string;
  result: "ANSWERED_CONFIRMED" | "ANSWERED_REFUSED" | "NO_ANSWER" | "BUSY" | "WRONG_NUMBER";
  note: string | null;
}

export interface OrderLineItem {
  id: string;
  sku: string | null;
  title: string;
  variantTitle: string | null;
  quantity: number;
  fulfilledQty: number;
  refundedQty: number;
  price: number;
}

export interface Order {
  id: string;
  storeId: string;
  storeName: string;
  externalOrderId: string;
  orderNumber: string;
  financialStatus: FinancialStatus;
  fulfillmentStatus: FulfillmentStatus;
  orderStatus: OrderStatus;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerPhone2?: string | null;
  shippingAddress?: any;
  billingAddress?: any;
  currency: string;
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  total: number;
  totalRefunded: number;
  tags: string[];
  notes: string | null;
  internalNote?: string | null;
  confirmationStatus: string | null;
  cancellationReason: string | null;
  cancellationNote: string | null;
  callAttempts: CallAttempt[];
  deliveryCompany?: string | null;
  scheduledDeliveryDate?: string | null;
  lineItems: OrderLineItem[];
  itemCount: number;
  trackingNumber: string | null;
  carrier: string | null;
  sourceCreatedAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  name: string;
  sourceType: StoreSourceType;
  isActive: boolean;
  orderCount?: number;
  domain?: string;
  currency?: string;
  createdAt?: string;
}

export interface StoreIntegration {
  id: string;
  storeId: string;
  type: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  label: string;
  config?: Record<string, string>;
  lastSyncAt?: string;
}

export interface DeliveryIntegrationConfig {
  id: string;
  storeId: string;
  provider: string;
  status: "CONNECTED" | "DISCONNECTED";
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  storeIds: string[];
  permissions?: string[];
  avatarInitials: string;
  isActive: boolean;
  createdAt: string;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  STORE_MANAGER: "Store Manager",
  STAFF: "Staff",
};
export const FINANCIAL_STATUS_LABELS: Record<FinancialStatus, string> = {
  PENDING: "Pending",
  AUTHORIZED: "Authorized",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  PARTIALLY_REFUNDED: "Partially Refunded",
  REFUNDED: "Refunded",
  VOIDED: "Voided",
};

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  UNFULFILLED: "Unfulfilled",
  PARTIAL: "Partial",
  FULFILLED: "Fulfilled",
  RESTOCKED: "Restocked",
  CANCELLED: "Cancelled",
};