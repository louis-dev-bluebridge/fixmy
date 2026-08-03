"use client";

import { useEffect, useState } from "react";
import type {
  ActivitySummary,
  AdminServiceSummary,
  AdminUserSummary,
  AuthResponse,
  JobSummary,
  PaymentProviderSummary,
  PaymentProviderType,
  ProStatus,
  SessionUser,
  UserStatus,
} from "@fixmy/contracts";
import {
  Activity,
  Ban,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Copy,
  Edit3,
  Eye,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Plug,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/backend";
type View = "overview" | "users" | "clients" | "pros" | "services" | "jobs" | "payments" | "integrations" | "activity";
type Transaction = {
  id: string;
  providerName: string;
  providerType: string;
  method: string;
  status: string;
  amountCents: number;
  currency: string;
  job: { id: string; title: string; client: string; status: string };
  refunds: Array<{ id: string; status: string; amountCents: number }>;
  createdAt: string;
};
type ProAdmin = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  profession: string;
  businessName?: string;
  bio?: string;
  vatNumber?: string;
  serviceArea: string;
  serviceRadiusKm: number;
  hourlyRateCents?: number;
  yearsExperience: number;
  services: Array<{ id: string; name: string; slug: string }>;
  rating: number;
  completedJobs: number;
  totalEarnedCents: number;
  isOnline: boolean;
  userStatus: UserStatus;
  status: ProStatus;
  createdAt: string;
};
type AdminDashboard = {
  users: number;
  clients: number;
  pros: number;
  pendingPros: number;
  services: number;
  jobs: Record<string, number>;
  payments: { count: number; volumeCents: number };
  refunds: { count: number; volumeCents: number };
  recentActivity: ActivitySummary[];
};
type UserDetail = {
  user: AdminUserSummary & { mustChangePassword?: boolean; updatedAt: string };
  pro?: ProAdmin & { approvalStatus: ProStatus };
  jobs: JobSummary[];
  refunds: Array<Record<string, unknown>>;
  activities: ActivitySummary[];
};
type ServiceDetail = {
  service: AdminServiceSummary;
  pros: Array<{ id: string; name: string; email: string; profession: string; status: ProStatus; userStatus: UserStatus; isOnline: boolean; rating: number; completedJobs: number }>;
  jobs: JobSummary[];
};
type JobDetail = { job: JobSummary; history: Array<{ id: string; status: string; actor: { id: string; name: string; role: string }; createdAt: string }>; payments: Array<Record<string, unknown>> };
type ConfirmAction = { title: string; description: string; tone?: "danger" | "primary"; label: string; run: () => Promise<void> };

const nav: Array<[View, string, typeof LayoutDashboard]> = [
  ["overview", "Resumen", LayoutDashboard],
  ["users", "Usuarios", Users],
  ["clients", "Clientes", UserRound],
  ["pros", "Pro Fixers", ShieldCheck],
  ["services", "Servicios", Wrench],
  ["jobs", "Trabajos", BriefcaseBusiness],
  ["payments", "Pagos", CircleDollarSign],
  ["integrations", "Integraciones", Plug],
  ["activity", "Actividad", Activity],
];

const money = (value = 0) => new Intl.NumberFormat("es-BE", { style: "currency", currency: "EUR" }).format(value / 100);
const date = (value?: string) => value ? new Intl.DateTimeFormat("es-BE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
const statusLabel: Record<string, string> = { ACTIVE: "Activo", SUSPENDED: "Suspendido", DELETED: "Eliminado", PENDING: "Pendiente", APPROVED: "Aprobado", REJECTED: "Rechazado", OPEN: "Publicado", ASSIGNED: "Asignado", COMPLETED: "Completado", CANCELLED: "Cancelado", SUCCEEDED: "Confirmado", REFUNDED: "Reembolsado", PARTIALLY_REFUNDED: "Reembolso parcial" };

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [view, setView] = useState<View>("overview");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [usersData, setUsersData] = useState<AdminUserSummary[]>([]);
  const [pros, setPros] = useState<ProAdmin[]>([]);
  const [services, setServices] = useState<AdminServiceSummary[]>([]);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [payments, setPayments] = useState<Transaction[]>([]);
  const [providers, setProviders] = useState<PaymentProviderSummary[]>([]);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [rowLoading, setRowLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [drawer, setDrawer] = useState<{ type: "user" | "service" | "job"; data: UserDetail | ServiceDetail | JobDetail } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [providerOpen, setProviderOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<PaymentProviderSummary | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [editingService, setEditingService] = useState<AdminServiceSummary | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<{ name: string; value: string } | null>(null);

  useEffect(() => setToken(localStorage.getItem("fixmy_admin_token") ?? ""), []);
  useEffect(() => { if (token) void refresh(); }, [token]);
  useEffect(() => { setSearch(""); setStatusFilter("ALL"); }, [view]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function api(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API}/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) { logout(); throw new Error("Sesión expirada"); }
    if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(". ") : body.message ?? "No se pudo completar la acción");
    return body;
  }

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const me = await api("/auth/me");
      if (me.role !== "ADMIN") throw new Error("Esta cuenta no es administradora");
      setUser(me);
      const [d, u, p, s, j, t, i, a] = await Promise.all([
        api("/admin/dashboard"), api("/admin/users"), api("/admin/pros"), api("/admin/services"), api("/admin/jobs"),
        api("/payments/admin/transactions"), api("/payments/admin/providers"), api("/admin/activity?limit=150"),
      ]);
      setDashboard(d); setUsersData(u); setPros(p); setServices(s); setJobs(j); setPayments(t); setProviders(i); setActivities(a);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { if (!silent) setLoading(false); }
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "No se pudo iniciar sesión");
      const auth = body as AuthResponse;
      if (auth.user.role !== "ADMIN") throw new Error("Esta cuenta no es administradora");
      localStorage.setItem("fixmy_admin_token", auth.token); setToken(auth.token); setUser(auth.user);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setLoading(false); }
  }

  function logout() { localStorage.removeItem("fixmy_admin_token"); setToken(""); setUser(null); setDrawer(null); }
  function notify(text: string) { setError(""); setMessage(text); }
  function fail(caught: unknown) { setError(caught instanceof Error ? caught.message : String(caught)); }

  async function openUser(id: string) {
    setDrawerLoading(true); setDrawer(null);
    try { setDrawer({ type: "user", data: await api(`/admin/users/${id}`) }); } catch (caught) { fail(caught); }
    finally { setDrawerLoading(false); }
  }
  async function openService(id: string) {
    setDrawerLoading(true); setDrawer(null);
    try { setDrawer({ type: "service", data: await api(`/admin/services/${id}`) }); } catch (caught) { fail(caught); }
    finally { setDrawerLoading(false); }
  }
  async function openJob(id: string) {
    setDrawerLoading(true); setDrawer(null);
    try { setDrawer({ type: "job", data: await api(`/admin/jobs/${id}`) }); } catch (caught) { fail(caught); }
    finally { setDrawerLoading(false); }
  }

  async function runRow(id: string, operation: () => Promise<void>) {
    setRowLoading(id); setError("");
    try { await operation(); await refresh(true); }
    catch (caught) { fail(caught); }
    finally { setRowLoading(""); }
  }

  function ask(action: ConfirmAction) { setConfirmAction(action); }
  async function executeConfirmed() {
    if (!confirmAction) return;
    const action = confirmAction; setConfirmAction(null);
    try { await action.run(); } catch (caught) { fail(caught); }
  }

  function changePro(id: string, name: string, next: "APPROVED" | "REJECTED") {
    ask({
      title: next === "APPROVED" ? `Aprobar a ${name}` : `Rechazar a ${name}`,
      description: next === "APPROVED" ? "El Pro podrá conectarse, recibir oportunidades y aceptar trabajos publicados." : "El Pro quedará fuera del marketplace y su disponibilidad se desactivará.",
      tone: next === "APPROVED" ? "primary" : "danger", label: next === "APPROVED" ? "Sí, aprobar" : "Sí, rechazar",
      run: () => runRow(id, async () => { await api(`/admin/pros/${id}/approval`, { method: "PATCH", body: JSON.stringify({ status: next }) }); notify(`Estado de ${name} actualizado`); }),
    });
  }

  function changeUserStatus(item: AdminUserSummary, next: "ACTIVE" | "SUSPENDED") {
    ask({
      title: next === "ACTIVE" ? `Reactivar a ${item.name}` : `Suspender a ${item.name}`,
      description: next === "ACTIVE" ? "La cuenta podrá volver a iniciar sesión y operar." : "La sesión actual dejará de funcionar y la cuenta no podrá operar hasta ser reactivada.",
      tone: next === "ACTIVE" ? "primary" : "danger", label: next === "ACTIVE" ? "Reactivar cuenta" : "Suspender cuenta",
      run: () => runRow(item.id, async () => { await api(`/admin/users/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }); notify(`Cuenta de ${item.name} ${next === "ACTIVE" ? "reactivada" : "suspendida"}`); if (drawer?.type === "user") await openUser(item.id); }),
    });
  }

  function resetPassword(item: { id: string; name: string }) {
    ask({ title: `Restablecer contraseña de ${item.name}`, description: "Se generará una contraseña temporal. La persona deberá cambiarla al volver a entrar.", label: "Generar contraseña", run: () => runRow(item.id, async () => { const result = await api(`/admin/users/${item.id}/reset-password`, { method: "POST" }); setTemporaryPassword({ name: item.name, value: result.temporaryPassword }); }) });
  }

  function deleteUser(item: { id: string; name: string }) {
    ask({ title: `Eliminar cuenta de ${item.name}`, description: "La cuenta quedará eliminada lógicamente. Los trabajos, pagos y registros históricos se conservarán para auditoría.", tone: "danger", label: "Eliminar cuenta", run: () => runRow(item.id, async () => { await api(`/admin/users/${item.id}`, { method: "DELETE" }); setDrawer(null); notify(`Cuenta de ${item.name} eliminada`); }) });
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setRowLoading(id);
    try { await api(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ name: form.get("name"), email: form.get("email"), phone: form.get("phone") }) }); notify("Perfil actualizado"); await refresh(true); await openUser(id); }
    catch (caught) { fail(caught); } finally { setRowLoading(""); }
  }

  async function saveService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setRowLoading("service-form");
    const body = { slug: form.get("slug"), icon: form.get("icon"), names: { es: form.get("nameEs"), fr: form.get("nameFr"), nl: form.get("nameNl"), en: form.get("nameEn"), pt: form.get("namePt") }, description: form.get("description"), isActive: form.get("active") === "on" };
    try { await api(editingService ? `/admin/services/${editingService.id}` : "/admin/services", { method: editingService ? "PATCH" : "POST", body: JSON.stringify(body) }); setServiceOpen(false); setEditingService(null); notify(editingService ? "Servicio actualizado" : "Servicio creado"); await refresh(true); }
    catch (caught) { fail(caught); } finally { setRowLoading(""); }
  }

  function cancelJob(item: JobSummary) {
    ask({ title: `Cancelar “${item.title}”`, description: "El trabajo pasará a CANCELLED y la intervención quedará registrada en su historial. Los reembolsos se gestionan por separado en Pagos.", tone: "danger", label: "Cancelar trabajo", run: () => runRow(item.id, async () => { await api(`/admin/jobs/${item.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "Cancelación operativa desde Administración" }) }); notify("Trabajo cancelado"); await openJob(item.id); }) });
  }

  async function refund(item: Transaction) {
    ask({ title: `Reembolsar ${money(item.amountCents)}`, description: `Se solicitará el reembolso completo del pago asociado a “${item.job.title}”.`, tone: "danger", label: "Confirmar reembolso", run: () => runRow(item.id, async () => { await api(`/payments/admin/transactions/${item.id}/refund`, { method: "POST", body: JSON.stringify({ reason: "Reembolso solicitado desde Administración" }) }); notify("Reembolso procesado"); }) });
  }

  async function saveProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setRowLoading("provider-form"); const form = new FormData(event.currentTarget);
    const type = String(form.get("type")) as PaymentProviderType;
    const credentials: Record<string, string> = {};
    for (const key of ["secretKey", "webhookSecret", "clientId", "clientSecret", "baseUrl"]) if (form.get(key)) credentials[key] = String(form.get(key));
    const body = { type, name: String(form.get("name")), supportedMethods: String(form.get("methods") ?? "").split(",").map((value) => value.trim()).filter(Boolean), mode: String(form.get("mode")), publicKey: String(form.get("publicKey") ?? ""), credentials, isActive: form.get("active") === "on", priority: Number(form.get("priority") ?? 0) };
    try { await api(editingProvider ? `/payments/admin/providers/${editingProvider.id}` : "/payments/admin/providers", { method: editingProvider ? "PATCH" : "POST", body: JSON.stringify(body) }); setProviderOpen(false); setEditingProvider(null); notify("Integración guardada con credenciales cifradas"); await refresh(true); }
    catch (caught) { fail(caught); } finally { setRowLoading(""); }
  }

  async function testProvider(id: string) {
    await runRow(id, async () => { const result = await api(`/payments/admin/providers/${id}/test`, { method: "POST" }); notify(result.message); });
  }

  const lowerSearch = search.trim().toLowerCase();
  const visibleUsers = usersData.filter((item) => (!lowerSearch || `${item.name} ${item.email} ${item.phone ?? ""}`.toLowerCase().includes(lowerSearch)) && (statusFilter === "ALL" || item.status === statusFilter));
  const visibleClients = visibleUsers.filter((item) => item.role === "CLIENT");
  const visiblePros = pros.filter((item) => (!lowerSearch || `${item.name} ${item.email} ${item.profession} ${item.businessName ?? ""}`.toLowerCase().includes(lowerSearch)) && (statusFilter === "ALL" || item.status === statusFilter || item.userStatus === statusFilter));
  const visibleServices = services.filter((item) => !lowerSearch || `${item.names.es} ${item.slug} ${item.description}`.toLowerCase().includes(lowerSearch));
  const visibleJobs = jobs.filter((item) => (!lowerSearch || `${item.title} ${item.category} ${item.address ?? ""} ${item.client?.name ?? ""}`.toLowerCase().includes(lowerSearch)) && (statusFilter === "ALL" || item.status === statusFilter));
  const visibleActivity = activities.filter((item) => (!lowerSearch || `${item.summary} ${item.action} ${item.actor?.name ?? ""}`.toLowerCase().includes(lowerSearch)) && (statusFilter === "ALL" || item.entityType === statusFilter));

  if (!user) return (
    <main className="admin-login">
      <section className="login-story"><span className="eyebrow">FIX MY OPERATIONS</span><h1>El marketplace, bajo control.</h1><p>Administra personas, servicios, trabajos, cobros e integraciones desde un único centro operativo.</p><div className="login-points"><span><ShieldCheck /> Verificación de Pros</span><span><Activity /> Historial de negocio</span><span><CircleDollarSign /> Control financiero</span></div></section>
      <form onSubmit={login}><div className="brand official"><img src="/brand/fixmy-official-logo.jpg" alt="FIX MY" /><b>ADMIN</b></div><h2>Acceso administrativo</h2><p>Usa una cuenta con rol ADMIN.</p><label>Correo electrónico<input name="email" type="email" defaultValue="admin@fixmy.local" required /></label><label>Contraseña<input name="password" type="password" defaultValue="Admin123!" required /></label><button disabled={loading}>{loading ? "Validando..." : "Entrar al Control Center"}</button>{error && <em>{error}</em>}</form>
    </main>
  );

  return (
    <main className="admin-shell">
      <aside className={mobileNav ? "open" : ""}>
        <div className="brand official"><img src="/brand/fixmy-official-logo.jpg" alt="FIX MY" /><b>ADMIN</b><button className="mobile-close" onClick={() => setMobileNav(false)}><X /></button></div>
        <nav>{nav.map(([key, label, Icon]) => <button key={key} className={view === key ? "active" : ""} onClick={() => { setView(key); setMobileNav(false); }}><Icon />{label}{key === "pros" && dashboard?.pendingPros ? <span className="nav-count">{dashboard.pendingPros}</span> : null}</button>)}</nav>
        <div className="side-bottom"><span>Sesión administrativa</span><strong>{user.name}</strong><small>{user.email}</small><button onClick={logout}><LogOut /> Cerrar sesión</button></div>
      </aside>

      <section className="admin-main">
        <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)}><Menu /></button><div><small>FIX MY CONTROL CENTER</small><h1>{nav.find(([key]) => key === view)?.[1]}</h1></div><div className="top-actions"><span className="live-dot">Sistema operativo</span><button onClick={() => refresh()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> {loading ? "Actualizando" : "Actualizar"}</button></div></header>

        {view === "overview" && <Overview dashboard={dashboard} activities={activities.slice(0, 8)} openUser={openUser} go={setView} />}
        {view === "users" && <><Toolbar search={search} setSearch={setSearch} placeholder="Buscar por nombre, correo o teléfono" status={statusFilter} setStatus={setStatusFilter} options={["ALL", "ACTIVE", "SUSPENDED", "DELETED"]} /><UsersTable items={visibleUsers} rowLoading={rowLoading} openUser={openUser} changeStatus={changeUserStatus} resetPassword={resetPassword} /></>}
        {view === "clients" && <><Toolbar search={search} setSearch={setSearch} placeholder="Buscar clientes" status={statusFilter} setStatus={setStatusFilter} options={["ALL", "ACTIVE", "SUSPENDED", "DELETED"]} /><ClientsGrid items={visibleClients} openUser={openUser} /></>}
        {view === "pros" && <><Toolbar search={search} setSearch={setSearch} placeholder="Buscar Pro, profesión o empresa" status={statusFilter} setStatus={setStatusFilter} options={["ALL", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"]} /><ProsTable items={visiblePros} rowLoading={rowLoading} openUser={openUser} changePro={changePro} /></>}
        {view === "services" && <><Toolbar search={search} setSearch={setSearch} placeholder="Buscar en el catálogo" action={<button className="primary-action" onClick={() => { setEditingService(null); setServiceOpen(true); }}><Plus /> Nuevo servicio</button>} /><ServicesGrid items={visibleServices} openService={openService} edit={(item) => { setEditingService(item); setServiceOpen(true); }} /></>}
        {view === "jobs" && <><Toolbar search={search} setSearch={setSearch} placeholder="Buscar trabajo, cliente o dirección" status={statusFilter} setStatus={setStatusFilter} options={["ALL", "DRAFT", "PAYMENT_PENDING", "OPEN", "ASSIGNED", "PRO_EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED"]} /><JobsTable items={visibleJobs} openJob={openJob} /></>}
        {view === "payments" && <PaymentsTable items={payments} refund={refund} rowLoading={rowLoading} />}
        {view === "integrations" && <Integrations items={providers} testProvider={testProvider} rowLoading={rowLoading} create={() => { setEditingProvider(null); setProviderOpen(true); }} edit={(item) => { setEditingProvider(item); setProviderOpen(true); }} />}
        {view === "activity" && <><Toolbar search={search} setSearch={setSearch} placeholder="Buscar acción, persona o evento" status={statusFilter} setStatus={setStatusFilter} options={["ALL", "USER", "SERVICE", "JOB", "PAYMENT", "PROVIDER"]} /><ActivityTimeline items={visibleActivity} openUser={openUser} /></>}

        {drawerLoading && <div className="drawer-loading"><RefreshCw className="spin" /> Cargando detalle...</div>}
        {drawer && <DetailDrawer drawer={drawer} close={() => setDrawer(null)} saveUser={saveUser} rowLoading={rowLoading} changeUserStatus={changeUserStatus} resetPassword={resetPassword} deleteUser={deleteUser} changePro={changePro} cancelJob={cancelJob} openUser={openUser} />}
        {confirmAction && <ConfirmModal action={confirmAction} close={() => setConfirmAction(null)} execute={executeConfirmed} />}
        {temporaryPassword && <PasswordModal data={temporaryPassword} close={() => setTemporaryPassword(null)} />}
        {serviceOpen && <ServiceModal editing={editingService} close={() => { setServiceOpen(false); setEditingService(null); }} save={saveService} loading={rowLoading === "service-form"} />}
        {providerOpen && <ProviderModal editing={editingProvider} close={() => { setProviderOpen(false); setEditingProvider(null); }} save={saveProvider} loading={rowLoading === "provider-form"} />}
        {error && <div className="admin-toast error" onClick={() => setError("")}><X />{error}</div>}
        {message && <div className="admin-toast success" onClick={() => setMessage("")}><Check />{message}</div>}
      </section>
    </main>
  );
}

function Toolbar({ search, setSearch, placeholder, status, setStatus, options, action }: { search: string; setSearch: (value: string) => void; placeholder: string; status?: string; setStatus?: (value: string) => void; options?: string[]; action?: React.ReactNode }) {
  return <div className="toolbar"><label className="search-box"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} /></label>{options && status && setStatus && <select value={status} onChange={(event) => setStatus(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option === "ALL" ? "Todos los estados" : statusLabel[option] ?? option}</option>)}</select>}{action}</div>;
}

function Empty({ text }: { text: string }) { return <div className="empty"><ClipboardList /><strong>Sin resultados</strong><p>{text}</p></div>; }
function Status({ value }: { value: string }) { return <span className={`status status-${value.toLowerCase()}`}>{statusLabel[value] ?? value}</span>; }

function Overview({ dashboard, activities, openUser, go }: { dashboard: AdminDashboard | null; activities: ActivitySummary[]; openUser: (id: string) => void; go: (view: View) => void }) {
  const activeJobs = Object.entries(dashboard?.jobs ?? {}).filter(([key]) => !["COMPLETED", "CANCELLED", "DRAFT"].includes(key)).reduce((sum, [, count]) => sum + count, 0);
  return <><div className="metrics six"><article><span>Usuarios</span><strong>{dashboard?.users ?? "—"}</strong><small>{dashboard?.clients ?? 0} clientes</small></article><article><span>Pro Fixers</span><strong>{dashboard?.pros ?? "—"}</strong><small>{dashboard?.pendingPros ?? 0} por revisar</small></article><article><span>Servicios activos</span><strong>{dashboard?.services ?? "—"}</strong><small>Catálogo global</small></article><article><span>Trabajos activos</span><strong>{activeJobs}</strong><small>{dashboard?.jobs?.COMPLETED ?? 0} completados</small></article><article><span>Volumen cobrado</span><strong>{money(dashboard?.payments.volumeCents)}</strong><small>{dashboard?.payments.count ?? 0} pagos</small></article><article><span>Reembolsos</span><strong>{money(dashboard?.refunds.volumeCents)}</strong><small>{dashboard?.refunds.count ?? 0} operaciones</small></article></div><div className="overview-grid"><section className="admin-card ops-card"><div className="card-head"><div><small>PRIORIDADES OPERATIVAS</small><h2>Lo que requiere atención</h2></div></div><button onClick={() => go("pros")}><ShieldCheck /><span><strong>{dashboard?.pendingPros ?? 0} Pros pendientes</strong><small>Revisar documentación y aprobar acceso</small></span><ChevronRight /></button><button onClick={() => go("jobs")}><BriefcaseBusiness /><span><strong>{dashboard?.jobs?.PAYMENT_FAILED ?? 0} pagos fallidos</strong><small>Trabajos que no pudieron publicarse</small></span><ChevronRight /></button><button onClick={() => go("integrations")}><Plug /><span><strong>Proveedores de pago</strong><small>Comprobar conexiones y credenciales</small></span><ChevronRight /></button></section><section className="admin-card"><div className="card-head"><div><small>TRAZABILIDAD</small><h2>Actividad reciente</h2></div><button className="text-action" onClick={() => go("activity")}>Ver todo</button></div><ActivityTimeline items={activities} compact openUser={openUser} /></section></div></>;
}

function UsersTable({ items, rowLoading, openUser, changeStatus, resetPassword }: { items: AdminUserSummary[]; rowLoading: string; openUser: (id: string) => void; changeStatus: (item: AdminUserSummary, next: "ACTIVE" | "SUSPENDED") => void; resetPassword: (item: AdminUserSummary) => void }) {
  if (!items.length) return <Empty text="No hay usuarios que coincidan con los filtros." />;
  return <section className="admin-card data-card"><div className="card-head"><div><small>DIRECTORIO CENTRAL</small><h2>{items.length} usuarios</h2></div></div><div className="table users-table"><div className="tr th"><span>Persona</span><span>Rol</span><span>Actividad</span><span>Estado</span><span>Acciones</span></div>{items.map((item) => <div className="tr" key={item.id}><span className="person"><i>{initials(item.name)}</i><b>{item.name}<small>{item.email}</small></b></span><span><b>{item.role}</b><small>Alta: {date(item.createdAt)}</small></span><span><b>{item.jobsCount} trabajos</b><small>{item.role === "CLIENT" ? `${money(item.totalSpentCents)} gastado` : `${money(item.totalEarnedCents)} ganado`}</small></span><span><Status value={item.status} />{item.proStatus && <small>Pro: {statusLabel[item.proStatus]}</small>}</span><span className="row-actions"><button title="Ver expediente" onClick={() => openUser(item.id)}><Eye /></button><button title="Restablecer contraseña" onClick={() => resetPassword(item)}><KeyRound /></button>{item.status === "ACTIVE" ? <button title="Suspender" disabled={rowLoading === item.id} onClick={() => changeStatus(item, "SUSPENDED")}><Ban /></button> : item.status === "SUSPENDED" ? <button title="Reactivar" disabled={rowLoading === item.id} onClick={() => changeStatus(item, "ACTIVE")}><Check /></button> : null}</span></div>)}</div></section>;
}

function ClientsGrid({ items, openUser }: { items: AdminUserSummary[]; openUser: (id: string) => void }) {
  if (!items.length) return <Empty text="No hay clientes que coincidan con los filtros." />;
  return <div className="client-grid">{items.map((item) => <article className="client-card" key={item.id}><header><i>{initials(item.name)}</i><Status value={item.status} /></header><h3>{item.name}</h3><p>{item.email}</p><div className="mini-metrics"><span><b>{item.jobsCount}</b> solicitudes</span><span><b>{money(item.totalSpentCents)}</b> pagado</span></div><footer><span>Cliente desde {date(item.createdAt)}</span><button onClick={() => openUser(item.id)}>Ver expediente <ChevronRight /></button></footer></article>)}</div>;
}

function ProsTable({ items, rowLoading, openUser, changePro }: { items: ProAdmin[]; rowLoading: string; openUser: (id: string) => void; changePro: (id: string, name: string, next: "APPROVED" | "REJECTED") => void }) {
  if (!items.length) return <Empty text="No hay profesionales que coincidan con los filtros." />;
  return <section className="admin-card data-card"><div className="card-head"><div><small>VERIFICACIÓN Y OPERACIONES</small><h2>{items.length} Pro Fixers</h2></div></div><div className="table pros-table"><div className="tr th"><span>Profesional</span><span>Servicios</span><span>Negocio</span><span>Estado</span><span>Decisión</span></div>{items.map((item) => <div className="tr" key={item.id}><span className="person"><i>{initials(item.name)}</i><b>{item.name}<small>{item.email}</small></b></span><span><b>{item.profession}</b><small>{item.services.map((service) => service.name).join(", ") || "Sin servicios"}</small></span><span><b>{item.businessName ?? "Profesional independiente"}</b><small>{item.serviceArea} · {item.yearsExperience} años</small></span><span><Status value={item.status} /><small>{item.isOnline ? "Disponible ahora" : "No disponible"}</small></span><span className="decision-actions"><button onClick={() => openUser(item.id)}><Eye /> Expediente</button>{item.status !== "REJECTED" && <button className="reject" disabled={rowLoading === item.id} onClick={() => changePro(item.id, item.name, "REJECTED")}><X /> Rechazar</button>}{item.status !== "APPROVED" && <button className="approve" disabled={rowLoading === item.id} onClick={() => changePro(item.id, item.name, "APPROVED")}><Check /> Aprobar</button>}</span></div>)}</div></section>;
}

function ServicesGrid({ items, openService, edit }: { items: AdminServiceSummary[]; openService: (id: string) => void; edit: (item: AdminServiceSummary) => void }) {
  if (!items.length) return <Empty text="No hay servicios que coincidan con la búsqueda." />;
  return <div className="service-grid">{items.map((item) => <article className="service-card" key={item.id}><header><i>{item.icon?.slice(0, 2) || "FX"}</i><Status value={item.isActive ? "ACTIVE" : "SUSPENDED"} /></header><h3>{item.names.es}</h3><p>{item.description}</p><div className="service-stats"><span><b>{item.approvedPros}</b> Pros aprobados</span><span><b>{item.pendingPros}</b> pendientes</span><span><b>{item.jobsCount}</b> trabajos</span><span><b>{money(item.revenueCents)}</b> completado</span></div><footer><button onClick={() => openService(item.id)}><Eye /> Ver detalle</button><button onClick={() => edit(item)}><Edit3 /> Editar</button></footer></article>)}</div>;
}

function JobsTable({ items, openJob }: { items: JobSummary[]; openJob: (id: string) => void }) {
  if (!items.length) return <Empty text="No hay trabajos que coincidan con los filtros." />;
  return <section className="admin-card data-card"><div className="card-head"><div><small>FLUJO DEL MARKETPLACE</small><h2>{items.length} trabajos</h2></div></div><div className="table jobs-table"><div className="tr th"><span>Trabajo</span><span>Cliente / Pro</span><span>Importe</span><span>Estado</span><span></span></div>{items.map((item) => <div className="tr" key={item.id}><span><b>{item.title}</b><small>{item.category} · {item.address}</small></span><span><b>{item.client?.name ?? "Cliente"}</b><small>{item.pro?.name ?? "Sin Pro asignado"}</small></span><span><b>{money(item.budgetCents)}</b><small>{item.payment?.status ? `Pago: ${statusLabel[item.payment.status] ?? item.payment.status}` : "Sin pago"}</small></span><span><Status value={item.status} /><small>{date(item.createdAt)}</small></span><span><button className="icon-text" onClick={() => openJob(item.id)}>Detalle <ChevronRight /></button></span></div>)}</div></section>;
}

function PaymentsTable({ items, refund, rowLoading }: { items: Transaction[]; refund: (item: Transaction) => void; rowLoading: string }) {
  const volume = items.filter((item) => ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(item.status)).reduce((sum, item) => sum + item.amountCents, 0);
  return <><div className="metrics three"><article><span>Transacciones</span><strong>{items.length}</strong><small>Histórico visible</small></article><article><span>Volumen procesado</span><strong>{money(volume)}</strong><small>Antes de reembolsos</small></article><article><span>Reembolsos</span><strong>{items.reduce((sum, item) => sum + item.refunds.reduce((value, refundItem) => value + refundItem.amountCents, 0), 0) / 100} €</strong><small>Acumulado</small></article></div><section className="admin-card data-card"><div className="card-head"><div><small>FINANZAS</small><h2>Transacciones</h2></div></div><div className="table payment-table"><div className="tr th"><span>Trabajo</span><span>Proveedor</span><span>Importe</span><span>Estado</span><span>Acción</span></div>{items.map((item) => <div className="tr" key={item.id}><span><b>{item.job.title}</b><small>{item.job.client} · {date(item.createdAt)}</small></span><span><b>{item.providerName}</b><small>{item.method} · {item.providerType}</small></span><span><b>{money(item.amountCents)}</b><small>{item.currency}</small></span><span><Status value={item.status} />{item.refunds.length > 0 && <small>{item.refunds.length} reembolso(s)</small>}</span><span>{item.status === "SUCCEEDED" && <button className="danger-text" disabled={rowLoading === item.id} onClick={() => refund(item)}>Reembolsar</button>}</span></div>)}</div></section></>;
}

function Integrations({ items, testProvider, rowLoading, create, edit }: { items: PaymentProviderSummary[]; testProvider: (id: string) => void; rowLoading: string; create: () => void; edit: (item: PaymentProviderSummary) => void }) {
  return <section className="admin-card"><div className="card-head"><div><small>PAGOS CONFIGURABLES</small><h2>Proveedores e integraciones</h2><p>Activa métodos sin recompilar. Los secretos permanecen cifrados en el servidor.</p></div><button className="primary-action" onClick={create}><Plus /> Agregar integración</button></div><div className="provider-grid">{items.map((item) => <article key={item.id}><header><i><Plug /></i><Status value={item.isActive ? "ACTIVE" : "SUSPENDED"} /></header><h3>{item.name}</h3><p>{item.type} · modo {item.mode}</p><div className="tags">{item.supportedMethods.map((method) => <span key={method}>{method}</span>)}</div><div className="provider-health"><span><ShieldCheck /> {item.hasCredentials ? "Credenciales cifradas" : "Sin credenciales"}</span><span>{item.lastTestedAt ? `${item.lastTestSucceeded ? "Conexión correcta" : "Prueba fallida"} · ${date(item.lastTestedAt)}` : "Sin probar"}</span></div><footer><button disabled={rowLoading === item.id} onClick={() => testProvider(item.id)}>{rowLoading === item.id ? "Probando..." : "Probar conexión"}</button><button className="primary-outline" onClick={() => edit(item)}>Configurar</button></footer></article>)}</div></section>;
}

function ActivityTimeline({ items, compact, openUser }: { items: ActivitySummary[]; compact?: boolean; openUser: (id: string) => void }) {
  if (!items.length) return <Empty text="Todavía no hay actividad de negocio para mostrar." />;
  return <div className={`activity-list ${compact ? "compact" : ""}`}>{items.map((item) => <article key={item.id}><i><Activity /></i><div><strong>{item.summary}</strong><p><span>{item.action.replaceAll("_", " ")}</span> · {item.entityType} · {date(item.createdAt)}</p></div>{item.actor && <button onClick={() => openUser(item.actor!.id)}>{item.actor.name}<ChevronRight /></button>}</article>)}</div>;
}

function DetailDrawer({ drawer, close, saveUser, rowLoading, changeUserStatus, resetPassword, deleteUser, changePro, cancelJob, openUser }: { drawer: { type: "user" | "service" | "job"; data: UserDetail | ServiceDetail | JobDetail }; close: () => void; saveUser: (event: React.FormEvent<HTMLFormElement>, id: string) => void; rowLoading: string; changeUserStatus: (item: AdminUserSummary, next: "ACTIVE" | "SUSPENDED") => void; resetPassword: (item: { id: string; name: string }) => void; deleteUser: (item: { id: string; name: string }) => void; changePro: (id: string, name: string, next: "APPROVED" | "REJECTED") => void; cancelJob: (item: JobSummary) => void; openUser: (id: string) => void }) {
  return <div className="drawer-back" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}><aside className="detail-drawer"><button className="drawer-close" onClick={close}><X /></button>{drawer.type === "user" && <UserDrawer data={drawer.data as UserDetail} saveUser={saveUser} rowLoading={rowLoading} changeUserStatus={changeUserStatus} resetPassword={resetPassword} deleteUser={deleteUser} changePro={changePro} />}{drawer.type === "service" && <ServiceDrawer data={drawer.data as ServiceDetail} openUser={openUser} />}{drawer.type === "job" && <JobDrawer data={drawer.data as JobDetail} cancelJob={cancelJob} openUser={openUser} />}</aside></div>;
}

function UserDrawer({ data, saveUser, rowLoading, changeUserStatus, resetPassword, deleteUser, changePro }: { data: UserDetail; saveUser: (event: React.FormEvent<HTMLFormElement>, id: string) => void; rowLoading: string; changeUserStatus: (item: AdminUserSummary, next: "ACTIVE" | "SUSPENDED") => void; resetPassword: (item: { id: string; name: string }) => void; deleteUser: (item: { id: string; name: string }) => void; changePro: (id: string, name: string, next: "APPROVED" | "REJECTED") => void }) {
  const item = data.user;
  return <><div className="drawer-hero"><i>{initials(item.name)}</i><div><small>EXPEDIENTE {item.role}</small><h2>{item.name}</h2><p>{item.email}</p></div><Status value={item.status} /></div><div className="drawer-actions"><button onClick={() => resetPassword(item)}><KeyRound /> Restablecer clave</button>{item.status === "ACTIVE" ? <button onClick={() => changeUserStatus(item, "SUSPENDED")}><Ban /> Suspender</button> : item.status === "SUSPENDED" ? <button onClick={() => changeUserStatus(item, "ACTIVE")}><Check /> Reactivar</button> : null}<button className="danger-text" onClick={() => deleteUser(item)}><Trash2 /> Eliminar</button></div>{data.pro && <section className="drawer-section pro-dossier"><div className="section-title"><h3>Perfil profesional</h3><Status value={data.pro.approvalStatus} /></div><div className="detail-grid"><span><small>Negocio</small><b>{data.pro.businessName ?? "Independiente"}</b></span><span><small>Profesión</small><b>{data.pro.profession}</b></span><span><small>Zona</small><b>{data.pro.serviceArea}</b></span><span><small>Radio</small><b>{data.pro.serviceRadiusKm} km</b></span><span><small>Experiencia</small><b>{data.pro.yearsExperience} años</b></span><span><small>Tarifa</small><b>{money(data.pro.hourlyRateCents)}</b></span></div><p>{data.pro.bio || "Sin biografía profesional."}</p><div className="tags">{data.pro.services?.map((service: any) => <span key={service.id}>{service.name}</span>)}</div><div className="approval-strip"><button className="reject" onClick={() => changePro(item.id, item.name, "REJECTED")}><X /> Rechazar Pro</button><button className="approve" onClick={() => changePro(item.id, item.name, "APPROVED")}><Check /> Aprobar Pro</button></div></section>}<section className="drawer-section"><h3>Editar cuenta</h3><form className="edit-form" onSubmit={(event) => saveUser(event, item.id)}><label>Nombre<input name="name" defaultValue={item.name} required /></label><label>Correo<input name="email" type="email" defaultValue={item.email} required /></label><label>Teléfono<input name="phone" defaultValue={item.phone ?? ""} /></label><button disabled={rowLoading === item.id}><Check /> Guardar cambios</button></form></section><section className="drawer-section"><div className="section-title"><h3>Trabajos</h3><span>{data.jobs.length}</span></div>{data.jobs.length ? data.jobs.slice(0, 8).map((job) => <div className="mini-row" key={job.id}><span><b>{job.title}</b><small>{job.category} · {date(job.createdAt)}</small></span><Status value={job.status} /><b>{money(job.budgetCents)}</b></div>) : <p className="muted">Sin trabajos registrados.</p>}</section><section className="drawer-section"><div className="section-title"><h3>Actividad sobre la cuenta</h3><span>{data.activities.length}</span></div><ActivityTimeline items={data.activities.slice(0, 20)} openUser={() => undefined} /></section></>;
}

function ServiceDrawer({ data, openUser }: { data: ServiceDetail; openUser: (id: string) => void }) {
  return <><div className="drawer-hero service"><i>{data.service.icon?.slice(0, 2)}</i><div><small>SERVICIO GLOBAL</small><h2>{data.service.names.es}</h2><p>/{data.service.slug}</p></div><Status value={data.service.isActive ? "ACTIVE" : "SUSPENDED"} /></div><section className="drawer-section"><h3>Contenido multilingüe</h3><p>{data.service.description}</p><div className="language-grid">{Object.entries(data.service.names).map(([lang, name]) => <span key={lang}><small>{lang.toUpperCase()}</small><b>{name}</b></span>)}</div></section><section className="drawer-section"><div className="section-title"><h3>Profesionales que lo prestan</h3><span>{data.pros.length}</span></div>{data.pros.length ? data.pros.map((pro) => <button className="pro-link" key={pro.id} onClick={() => openUser(pro.id)}><i>{initials(pro.name)}</i><span><b>{pro.name}</b><small>{pro.profession} · {pro.email}</small></span><Status value={pro.status} /><ChevronRight /></button>) : <p className="muted">Ningún Pro ofrece todavía este servicio.</p>}</section><section className="drawer-section"><div className="section-title"><h3>Trabajos recientes</h3><span>{data.jobs.length}</span></div>{data.jobs.slice(0, 10).map((job) => <div className="mini-row" key={job.id}><span><b>{job.title}</b><small>{job.client?.name} · {date(job.createdAt)}</small></span><Status value={job.status} /><b>{money(job.budgetCents)}</b></div>)}</section></>;
}

function JobDrawer({ data, cancelJob, openUser }: { data: JobDetail; cancelJob: (item: JobSummary) => void; openUser: (id: string) => void }) {
  const item = data.job;
  return <><div className="drawer-hero job"><i><BriefcaseBusiness /></i><div><small>EXPEDIENTE DE TRABAJO</small><h2>{item.title}</h2><p>{item.category} · {item.address}</p></div><Status value={item.status} /></div>{!["COMPLETED", "CANCELLED"].includes(item.status) && <div className="drawer-actions"><button className="danger-text" onClick={() => cancelJob(item)}><Ban /> Cancelar trabajo</button></div>}<section className="drawer-section"><h3>Resumen operativo</h3><div className="detail-grid"><span><small>Presupuesto</small><b>{money(item.budgetCents)}</b></span><span><small>Pago</small><b>{item.payment?.status ?? "Sin pago"}</b></span><button onClick={() => item.client?.id && openUser(item.client.id)}><small>Cliente</small><b>{item.client?.name ?? "—"}</b></button><button onClick={() => item.pro?.id && openUser(item.pro.id)}><small>Pro asignado</small><b>{item.pro?.name ?? "Sin asignar"}</b></button></div><p>{item.description}</p></section><section className="drawer-section"><div className="section-title"><h3>Historial de estados</h3><span>{data.history.length}</span></div><div className="job-timeline">{data.history.map((history, index) => <article key={history.id}><i>{index + 1}</i><div><b>{statusLabel[history.status] ?? history.status}</b><small>{history.actor.name} · {history.actor.role}</small></div><time>{date(history.createdAt)}</time></article>)}</div></section><section className="drawer-section"><div className="section-title"><h3>Intentos de pago</h3><span>{data.payments.length}</span></div>{data.payments.length ? data.payments.map((payment: any) => <div className="mini-row" key={payment.id}><span><b>{payment.provider?.name ?? "Proveedor"}</b><small>{payment.method} · {date(payment.createdAt)}</small></span><Status value={payment.status} /><b>{money(payment.amountCents)}</b></div>) : <p className="muted">Sin pagos registrados.</p>}</section></>;
}

function ConfirmModal({ action, close, execute }: { action: ConfirmAction; close: () => void; execute: () => void }) {
  return <div className="modal-back"><section className="confirm-card"><i className={action.tone === "danger" ? "danger" : "primary"}>{action.tone === "danger" ? <Ban /> : <ShieldCheck />}</i><h2>{action.title}</h2><p>{action.description}</p><div><button onClick={close}>Volver</button><button className={action.tone === "danger" ? "danger-button" : "primary-action"} onClick={execute}>{action.label}</button></div></section></div>;
}

function PasswordModal({ data, close }: { data: { name: string; value: string }; close: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(data.value); setCopied(true); }
  return <div className="modal-back"><section className="confirm-card password-card"><i className="primary"><KeyRound /></i><small>CONTRASEÑA TEMPORAL</small><h2>Clave para {data.name}</h2><p>Esta contraseña solo se muestra ahora. Entrégala por un canal seguro.</p><button className="password-value" onClick={copy}><code>{data.value}</code><span>{copied ? <Check /> : <Copy />}{copied ? "Copiada" : "Copiar"}</span></button><button className="primary-action full" onClick={close}>Entendido, cerrar</button></section></div>;
}

function ServiceModal({ editing, close, save, loading }: { editing: AdminServiceSummary | null; close: () => void; save: (event: React.FormEvent<HTMLFormElement>) => void; loading: boolean }) {
  return <div className="modal-back"><form className="entity-form" onSubmit={save}><button type="button" className="modal-close" onClick={close}><X /></button><small>CATÁLOGO GLOBAL</small><h2>{editing ? "Editar servicio" : "Crear servicio"}</h2><div className="form-cols"><label>Nombre en español<input name="nameEs" defaultValue={editing?.names.es ?? ""} required /></label><label>Slug<input name="slug" defaultValue={editing?.slug ?? ""} placeholder="cerrajeria" required /></label><label>Nombre en francés<input name="nameFr" defaultValue={editing?.names.fr ?? ""} /></label><label>Nombre en neerlandés<input name="nameNl" defaultValue={editing?.names.nl ?? ""} /></label><label>Nombre en inglés<input name="nameEn" defaultValue={editing?.names.en ?? ""} /></label><label>Nombre en portugués<input name="namePt" defaultValue={editing?.names.pt ?? ""} /></label><label>Icono / clave visual<input name="icon" defaultValue={editing?.icon ?? "Wrench"} /></label><label className="check"><input name="active" type="checkbox" defaultChecked={editing?.isActive ?? true} /> Servicio visible y activo</label><label className="wide">Descripción<textarea name="description" defaultValue={editing?.description ?? ""} rows={4} required /></label></div><button className="primary-action full" disabled={loading}>{loading ? "Guardando..." : "Guardar servicio"}</button></form></div>;
}

function ProviderModal({ editing, close, save, loading }: { editing: PaymentProviderSummary | null; close: () => void; save: (event: React.FormEvent<HTMLFormElement>) => void; loading: boolean }) {
  return <div className="modal-back"><form className="entity-form provider-form" onSubmit={save}><button type="button" className="modal-close" onClick={close}><X /></button><small>INTEGRACIÓN DE PAGO</small><h2>{editing ? "Configurar proveedor" : "Agregar proveedor"}</h2><div className="form-cols"><label>Tipo<select name="type" defaultValue={editing?.type ?? "STRIPE"}><option>MOCK</option><option>STRIPE</option><option>PAYPAL</option><option>PAYCONIQ</option><option>GENERIC_REST</option></select></label><label>Nombre<input name="name" defaultValue={editing?.name ?? ""} required /></label><label className="wide">Métodos separados por coma<input name="methods" defaultValue={editing?.supportedMethods.join(", ") ?? "card, bancontact"} required /></label><label>Modo<select name="mode" defaultValue={editing?.mode ?? "test"}><option value="test">Test</option><option value="live">Live</option></select></label><label>Prioridad<input name="priority" type="number" defaultValue={editing?.priority ?? 10} /></label><label className="wide">Clave pública<input name="publicKey" defaultValue={editing?.publicKey ?? ""} placeholder="pk_test_..." /></label><label className="wide">Secret key<input name="secretKey" type="password" placeholder={editing?.hasCredentials ? "Dejar vacío para conservar" : "sk_test_..."} /></label><label className="wide">Webhook secret<input name="webhookSecret" type="password" placeholder="whsec_..." /></label><label>Client ID<input name="clientId" type="password" /></label><label>Client Secret<input name="clientSecret" type="password" /></label><label className="wide">Base URL para REST<input name="baseUrl" placeholder="https://api.proveedor.com" /></label><label className="check wide"><input name="active" type="checkbox" defaultChecked={editing?.isActive ?? false} /> Mostrar este proveedor a clientes</label></div><p className="secure-note"><ShieldCheck /> Los secretos se cifran en el servidor y nunca vuelven al navegador.</p><button className="primary-action full" disabled={loading}>{loading ? "Cifrando y guardando..." : "Guardar integración"}</button></form></div>;
}
