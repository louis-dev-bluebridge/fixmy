export type Locale = "es" | "fr" | "nl" | "en" | "pt";
export type UserRole = "CLIENT" | "PRO" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";
export type ProStatus = "PENDING" | "APPROVED" | "REJECTED";
export type JobStatus = "DRAFT" | "PAYMENT_PENDING" | "PAYMENT_FAILED" | "OPEN" | "ASSIGNED" | "PRO_EN_ROUTE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type PaymentProviderType = "MOCK" | "STRIPE" | "PAYPAL" | "PAYCONIQ" | "GENERIC_REST";
export type PaymentStatus = "CREATED" | "PENDING" | "REQUIRES_ACTION" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  proStatus?: ProStatus;
  mustChangePassword?: boolean;
};

export type AuthResponse = { token: string; user: SessionUser };

export type ServiceCategory = {
  id: string;
  slug: string;
  icon: string;
  names: Record<Locale, string>;
  description: string;
  activePros: number;
};

export type ProSummary = {
  id: string;
  name: string;
  email?: string;
  profession: string;
  category?: string;
  bio?: string;
  rating: number;
  completedJobs: number;
  distanceKm: number;
  isOnline?: boolean;
  status: ProStatus;
};

export type ProServiceSummary = {
  categoryId: string;
  slug: string;
  icon: string;
  name: string;
  description: string;
};

export type ProDashboard = {
  profile: {
    id: string;
    name: string;
    email: string;
    profession: string;
    bio?: string;
    businessName?: string;
    phone?: string;
    vatNumber?: string;
    serviceArea: string;
    serviceRadiusKm: number;
    hourlyRateCents?: number;
    yearsExperience: number;
    approvalStatus: ProStatus;
    rating: number;
    completedJobs: number;
    isOnline: boolean;
  };
  services: ProServiceSummary[];
  metrics: {
    availableJobs: number;
    activeJobs: number;
    completedJobs: number;
    totalEarnedCents: number;
    monthEarnedCents: number;
  };
};

export type JobSummary = {
  id: string;
  categoryId?: string;
  category: string;
  title: string;
  description?: string;
  address?: string;
  budgetCents?: number;
  currency?: string;
  status: JobStatus;
  etaMinutes: number;
  location: { lat: number; lng: number };
  client?: { id: string; name: string };
  pro?: ProSummary;
  payment?: PaymentSummary;
  createdAt?: string;
};

export type PaymentMethodSummary = {
  providerId: string;
  providerType: PaymentProviderType;
  providerName: string;
  method: string;
  label: string;
  mode: string;
  publicKey?: string;
};

export type PaymentSummary = {
  id: string;
  providerId: string;
  providerName: string;
  providerType: PaymentProviderType;
  method: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  externalReference?: string;
  paidAt?: string;
  createdAt: string;
};

export type PaymentProviderSummary = {
  id: string;
  type: PaymentProviderType;
  name: string;
  supportedMethods: string[];
  mode: string;
  isActive: boolean;
  priority: number;
  publicKey?: string;
  hasCredentials: boolean;
  lastTestedAt?: string;
  lastTestSucceeded?: boolean;
};

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  proStatus?: ProStatus;
  createdAt: string;
  jobsCount: number;
  totalSpentCents: number;
  totalEarnedCents: number;
};

export type ActivitySummary = {
  id: string;
  actor?: { id: string; name: string; role: UserRole };
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type SystemLogSummary = {
  id: string;
  level: "INFO" | "WARN" | "ERROR";
  source: string;
  message: string;
  stack?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  requestId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type AdminServiceSummary = ServiceCategory & {
  approvedPros: number;
  pendingPros: number;
  jobsCount: number;
  completedJobs: number;
  revenueCents: number;
  isActive: boolean;
};

export type CheckoutResponse = {
  payment: PaymentSummary;
  mode: "mock" | "stripe" | "redirect";
  clientSecret?: string;
  redirectUrl?: string;
};

export type ClientRegistrationInput = { name: string; email: string; password: string };
export type ProRegistrationInput = { name: string; email: string; password: string; profession: string; categoryId: string };
export type LoginInput = { email: string; password: string };
