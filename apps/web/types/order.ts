// Canonical types — mirrors apps/api/prisma/schema.prisma exactly.
// When the backend is built, these get moved to packages/shared-types
// and imported by both apps so they never drift apart.

export type StoreSourceType = "SHOPIFY" | "CUSTOM" | "MARKETPLACE";

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
export interface CallAttempt {
  id: string;
  date: string;
  phone: string;
  result: "ANSWERED_CONFIRMED" | "ANSWERED_REFUSED" | "NO_ANSWER" | "BUSY" | "WRONG_NUMBER";
  note: string | null;
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
  scheduledDeliveryDate?: string | null;
  deliveryCompany?: string | null;
  internalNote?: string | null;

  currency: string;
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  total: number;
  totalRefunded: number;
  confirmationStatus: string | null;
  cancellationReason: string | null;
  cancellationNote: string | null;
  callAttempts: CallAttempt[];
  tags: string[];
  lineItems: OrderLineItem[];
  itemCount: number;

  trackingNumber?: string | null;
  carrier?: string | null;

  sourceCreatedAt: string;
  updatedAt: string;
}

export interface OrderFilters {
  storeIds: string[];
  orderStatus: OrderStatus[];
  financialStatus: FinancialStatus[];
  fulfillmentStatus: FulfillmentStatus[];
  search: string;
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  pageSize: number;
}

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
  PARTIAL: "Partially Fulfilled",
  FULFILLED: "Fulfilled",
  RESTOCKED: "Restocked",
  CANCELLED: "Cancelled",
};

// ----------- AUTH / USERS -----------

export type UserRole = "SUPER_ADMIN" | "STORE_MANAGER" | "STAFF";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  STORE_MANAGER: "Store Manager",
  STAFF: "Staff",
};

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string; // mock only — plaintext for local demo, never do this with a real backend
  role: UserRole;
  storeIds: string[]; // which stores this user can access; ignored if SUPER_ADMIN
  avatarInitials: string;
  isActive: boolean;
  createdAt: string;
}

// ----------- INTEGRATIONS -----------

export type IntegrationType = "SHOPIFY" | "GENERIC_API" | "GOOGLE_SHEETS";
export type IntegrationStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";

export interface DeliveryIntegrationConfig {
  id: string;
  storeId: string;
  provider: string;
  status: IntegrationStatus;
  trackingWebhookUrl?: string;
}

export interface StoreIntegration {
  id: string;
  storeId: string;
  type: IntegrationType;
  status: IntegrationStatus;
  label: string;
  config: Record<string, string>;
  lastSyncAt: string | null;
}