"use client";

import { useEffect, useState } from "react";
import type { AuthResponse, JobStatus, JobSummary, ProDashboard, ServiceCategory, SessionUser } from "@fixmy/contracts";
import { BriefcaseBusiness, Check, ChevronRight, CircleDollarSign, Clock3, LayoutDashboard, LogOut, MapPin, Menu, Plus, RefreshCw, Save, Settings2, ShieldCheck, Star, Store, ToggleLeft, ToggleRight, UserRound, Wrench, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/backend";
type View = "overview" | "opportunities" | "jobs" | "services" | "profile";
const views: Array<[View, string, typeof LayoutDashboard]> = [
  ["overview", "Resumen", LayoutDashboard],
  ["opportunities", "Oportunidades", BriefcaseBusiness],
  ["jobs", "Mis trabajos", Wrench],
  ["services", "Mis servicios", Store],
  ["profile", "Perfil profesional", UserRound],
];
const statusLabel: Record<string, string> = { ASSIGNED: "Asignado", PRO_EN_ROUTE: "En camino", IN_PROGRESS: "En curso", COMPLETED: "Completado", CANCELLED: "Cancelado" };

export default function ProPage() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [dashboard, setDashboard] = useState<ProDashboard | null>(null);
  const [available, setAvailable] = useState<JobSummary[]>([]);
  const [mine, setMine] = useState<JobSummary[]>([]);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [view, setView] = useState<View>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobSummary | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  useEffect(() => {
    setToken(localStorage.getItem("fixmy_pro_token") ?? "");
    fetch(`${API}/api/categories`).then((response) => response.ok ? response.json() : Promise.reject()).then(setCategories).catch(() => setError("No se pudo cargar el catálogo de servicios"));
  }, []);
  useEffect(() => { if (token) void refresh(); }, [token]);
  useEffect(() => { if (dashboard) setServiceIds(dashboard.services.map((service) => service.categoryId)); }, [dashboard]);

  async function api(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API}/api${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers } });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) logout();
    if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(". ") : body.message ?? "Error de la API");
    return body;
  }

  async function refresh() {
    setBusy("refresh"); setError("");
    try {
      const me: SessionUser = await api("/auth/me");
      if (me.role !== "PRO") throw new Error("Usa una cuenta Pro Fixer");
      setUser(me);
      if (me.mustChangePassword) { setDashboard(null); setAvailable([]); setMine([]); return; }
      if (me.proStatus === "APPROVED") {
        const [proData, newAvailable, newMine] = await Promise.all([api("/pro/dashboard"), api("/jobs/available"), api("/jobs/mine")]);
        setDashboard(proData); setAvailable(newAvailable); setMine(newMine);
      } else {
        setDashboard(await api("/pro/dashboard")); setAvailable([]); setMine([]);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(""); }
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("auth"); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register/pro";
      const response = await fetch(`${API}/api${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mode === "login" ? { email: form.get("email"), password: form.get("password") } : { name: form.get("name"), email: form.get("email"), password: form.get("password"), profession: form.get("profession"), categoryId: form.get("categoryId") }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(". ") : body.message ?? "No se pudo autenticar");
      const auth = body as AuthResponse;
      if (!auth.token || auth.user.role !== "PRO") throw new Error("Esta cuenta no pertenece a un Pro Fixer");
      localStorage.setItem("fixmy_pro_token", auth.token); setToken(auth.token); setUser(auth.user);
      setMessage(mode === "register" ? "Cuenta profesional creada. Completa tu perfil mientras Administración revisa la aprobación." : "Sesión Pro iniciada.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(""); }
  }

  async function changeRequiredPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("password"); setError("");
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    try {
      if (newPassword !== confirmPassword) throw new Error("Las contraseñas nuevas no coinciden");
      await api("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      setUser((current) => current ? { ...current, mustChangePassword: false } : current);
      setMessage("Contraseña actualizada. Ya puedes administrar tu negocio.");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(""); }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("profile"); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result: ProDashboard = await api("/pro/profile", { method: "PATCH", body: JSON.stringify({ name: form.get("name"), businessName: form.get("businessName"), profession: form.get("profession"), phone: form.get("phone"), vatNumber: form.get("vatNumber"), bio: form.get("bio"), serviceArea: form.get("serviceArea"), serviceRadiusKm: Number(form.get("serviceRadiusKm")), hourlyRateCents: Math.round(Number(form.get("hourlyRate")) * 100), yearsExperience: Number(form.get("yearsExperience")) }) });
      setDashboard(result); setUser((current) => current ? { ...current, name: result.profile.name } : current); setMessage("Perfil profesional guardado correctamente.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(""); }
  }

  async function saveServices() {
    setBusy("services"); setError("");
    try { const result: ProDashboard = await api("/pro/services", { method: "PATCH", body: JSON.stringify({ categoryIds: serviceIds }) }); setDashboard(result); setMessage("Catálogo de servicios actualizado."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(""); }
  }

  async function toggleAvailability() {
    if (!dashboard) return; setBusy("availability"); setError("");
    try { const result: ProDashboard = await api("/pro/availability", { method: "PATCH", body: JSON.stringify({ isOnline: !dashboard.profile.isOnline }) }); setDashboard(result); setMessage(result.profile.isOnline ? "Ahora apareces disponible para clientes." : "Te marcaste como no disponible."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(""); }
  }

  async function accept(id: string) {
    if (!confirm("¿Aceptar este trabajo? Quedará asignado a tu cuenta profesional.")) return;
    setBusy(id); setError("");
    try { await api(`/jobs/${id}/accept`, { method: "POST" }); setSelectedJob(null); setView("jobs"); setMessage("Trabajo aceptado y agregado a Mis trabajos."); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); await refresh(); }
    finally { setBusy(""); }
  }

  async function advance(job: JobSummary) {
    const next: Partial<Record<JobStatus, JobStatus>> = { ASSIGNED: "PRO_EN_ROUTE", PRO_EN_ROUTE: "IN_PROGRESS", IN_PROGRESS: "COMPLETED" };
    const status = next[job.status]; if (!status) return;
    setBusy(job.id); setError("");
    try { await api(`/jobs/${job.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); setMessage(status === "COMPLETED" ? "Trabajo completado y añadido a tus métricas." : "Estado del trabajo actualizado."); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(""); }
  }

  function logout() { localStorage.removeItem("fixmy_pro_token"); setToken(""); setUser(null); setDashboard(null); setMine([]); setAvailable([]); }
  function chooseView(next: View) { setView(next); setMobileNav(false); }

  if (!user) return <main className="pro-auth"><section><div className="pro-brand"><img src="/brand/fixmy-official-logo.jpg" alt="FIX MY"/><b>PRO</b></div><span className="eyebrow">PRO FIXER BUSINESS</span><h1>{mode === "login" ? "Administra tu actividad" : "Crea tu negocio en FIX MY"}</h1><p>Publica tus servicios, recibe oportunidades y gestiona cada trabajo desde un panel profesional.</p><form onSubmit={submitAuth}>{mode === "register" && <><input name="name" placeholder="Nombre completo" required/><input name="profession" placeholder="Profesión o especialidad" required/><select name="categoryId" required><option value="">Servicio principal</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.names.es}</option>)}</select></>}<input name="email" type="email" placeholder="Email" required/><input name="password" type="password" placeholder="Contraseña (mínimo 6)" minLength={6} required/><button disabled={busy === "auth"}>{busy === "auth" ? "Procesando..." : mode === "login" ? "Entrar al panel" : "Crear cuenta Pro"}</button></form>{error && <em>{error}</em>}<button className="auth-switch" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Crear una cuenta profesional" : "Ya tengo cuenta Pro"}</button></section></main>;

  if (user.mustChangePassword) return <main className="pro-password-gate"><form onSubmit={changeRequiredPassword}><div className="pro-brand"><img src="/brand/fixmy-official-logo.jpg" alt="FIX MY"/><b>PRO</b></div><span>SEGURIDAD PROFESIONAL</span><h1>Crea una nueva contraseña</h1><p>Administración restableció tu acceso. Debes reemplazar la contraseña temporal antes de administrar tu actividad.</p><label>Contraseña temporal<input name="currentPassword" type="password" required/></label><label>Nueva contraseña<input name="newPassword" type="password" minLength={8} required/></label><label>Confirmar nueva contraseña<input name="confirmPassword" type="password" minLength={8} required/></label><button disabled={busy === "password"}>{busy === "password" ? "Actualizando..." : "Guardar y entrar"}</button><button type="button" className="auth-switch" onClick={logout}>Cerrar sesión</button>{error && <em>{error}</em>}</form></main>;

  if (!dashboard) return <main className="loading-screen"><RefreshCw className="spin"/><p>Cargando tu negocio...</p>{error && <em>{error}</em>}</main>;

  const profile = dashboard.profile;
  const activeJobs = mine.filter((job) => ["ASSIGNED", "PRO_EN_ROUTE", "IN_PROGRESS"].includes(job.status));
  const pastJobs = mine.filter((job) => ["COMPLETED", "CANCELLED"].includes(job.status));
  const profileScore = [profile.businessName, profile.phone, profile.bio, profile.vatNumber, dashboard.services.length > 0].filter(Boolean).length * 20;

  if (user.proStatus !== "APPROVED") return <main className="pending-pro"><header><div className="pro-brand"><img src="/brand/fixmy-official-logo.jpg" alt="FIX MY"/><b>PRO</b></div><button onClick={logout}><LogOut/> Salir</button></header><div className="pending-grid"><section className="pending-copy"><span>APROBACIÓN EN PROCESO</span><h1>Prepara tu negocio mientras revisamos tu cuenta.</h1><p>La Administración debe aprobar tu identidad antes de mostrar oportunidades, pero ya puedes completar tu perfil y tus servicios.</p><div className="approval-steps"><div className="done"><Check/> Cuenta creada</div><div className="current"><ShieldCheck/> Revisión administrativa</div><div><BriefcaseBusiness/> Recibir trabajos</div></div><button onClick={() => void refresh()}><RefreshCw/> Comprobar aprobación</button></section><section className="pending-actions"><article><Store/><div><strong>Configura tus servicios</strong><p>Selecciona todas las categorías que realmente ofreces.</p></div><button onClick={() => setView("services")}>Configurar</button></article><article><UserRound/><div><strong>Completa tu perfil</strong><p>Añade empresa, teléfono, experiencia, tarifa y zona.</p></div><button onClick={() => setView("profile")}>Completar</button></article><div className="pending-editor">{view === "services" ? <ServicesPanel categories={categories} selected={serviceIds} setSelected={setServiceIds} save={saveServices} busy={busy === "services"}/> : view === "profile" ? <ProfileForm dashboard={dashboard} save={saveProfile} busy={busy === "profile"}/> : <><img src="/brand/fixi-mascot.jpg" alt="Fixi"/><h3>Fixi te ayudará a estar listo</h3><p>Completa la configuración usando las acciones de arriba. Luego abre Administración en localhost:3001 para aprobar la cuenta.</p></>}</div></section></div>{error && <div className="pro-toast error" onClick={() => setError("")}>{error}</div>}{message && <div className="pro-toast success" onClick={() => setMessage("")}>{message}</div>}</main>;

  return <main className="pro-app"><aside className={mobileNav ? "open" : ""}><div className="pro-brand"><img src="/brand/fixmy-official-logo.jpg" alt="FIX MY"/><b>PRO</b></div><nav>{views.map(([key, label, Icon]) => <button key={key} className={view === key ? "active" : ""} onClick={() => chooseView(key)}><Icon/>{label}{key === "opportunities" && available.length > 0 && <span>{available.length}</span>}</button>)}</nav><div className="pro-side-foot"><small>Cuenta profesional</small><strong>{profile.businessName || profile.name}</strong><span><Star size={14} fill="currentColor"/> {profile.rating.toFixed(1)} · {profile.completedJobs} trabajos</span><button onClick={logout}><LogOut/> Cerrar sesión</button></div></aside><section className="pro-workspace"><header className="pro-topbar"><button className="menu-button" onClick={() => setMobileNav(!mobileNav)}><Menu/></button><div><small>FIX MY PRO CENTER</small><h1>{views.find(([key]) => key === view)?.[1]}</h1></div><div className="top-actions"><button className={`availability ${profile.isOnline ? "online" : ""}`} disabled={busy === "availability"} onClick={() => void toggleAvailability()}>{profile.isOnline ? <ToggleRight/> : <ToggleLeft/>}<span>{profile.isOnline ? "Disponible" : "No disponible"}</span></button><button className="icon-button" disabled={busy === "refresh"} onClick={() => void refresh()}><RefreshCw className={busy === "refresh" ? "spin" : ""}/></button><div className="top-user"><div>{profile.name.slice(0, 1).toUpperCase()}</div><span><strong>{profile.name}</strong><small>Pro aprobado</small></span></div></div></header><div className="pro-content">
    {view === "overview" && <Overview dashboard={dashboard} activeJobs={activeJobs} available={available} chooseView={chooseView} advance={advance} busy={busy}/>} 
    {view === "opportunities" && <Opportunities jobs={available} open={setSelectedJob}/>} 
    {view === "jobs" && <JobsPanel active={activeJobs} past={pastJobs} advance={advance} busy={busy}/>} 
    {view === "services" && <ServicesPanel categories={categories} selected={serviceIds} setSelected={setServiceIds} save={saveServices} busy={busy === "services"}/>} 
    {view === "profile" && <><div className="profile-score"><div><strong>{profileScore}%</strong><span>Perfil completo</span></div><p>Los perfiles completos generan más confianza y mejores oportunidades.</p><i><b style={{ width: `${profileScore}%` }}/></i></div><ProfileForm dashboard={dashboard} save={saveProfile} busy={busy === "profile"}/></>}
  </div></section>{selectedJob && <JobModal job={selectedJob} close={() => setSelectedJob(null)} accept={accept} busy={busy === selectedJob.id}/>} {error && <div className="pro-toast error" onClick={() => setError("")}>{error}</div>} {message && <div className="pro-toast success" onClick={() => setMessage("")}>{message}</div>}</main>;
}

function Overview({ dashboard, activeJobs, available, chooseView, advance, busy }: { dashboard: ProDashboard; activeJobs: JobSummary[]; available: JobSummary[]; chooseView: (view: View) => void; advance: (job: JobSummary) => void; busy: string }) {
  const metrics = dashboard.metrics;
  return <><section className="welcome-card"><div><span>BUEN DÍA, {(dashboard.profile.name.split(" ")[0] ?? dashboard.profile.name).toUpperCase()}</span><h2>Tu actividad profesional, en un solo lugar.</h2><p>Gestiona disponibilidad, solicitudes, servicios y reputación.</p><button onClick={() => chooseView("opportunities")}>Ver oportunidades <ChevronRight/></button></div><img src="/brand/fixi-mascot.jpg" alt="Fixi"/></section><div className="pro-metrics"><article><BriefcaseBusiness/><div><span>Oportunidades</span><strong>{metrics.availableJobs}</strong><small>compatibles ahora</small></div></article><article><Wrench/><div><span>Trabajos activos</span><strong>{metrics.activeJobs}</strong><small>en ejecución</small></div></article><article><CircleDollarSign/><div><span>Ingresos del mes</span><strong>€{(metrics.monthEarnedCents / 100).toFixed(0)}</strong><small>trabajos completados</small></div></article><article><Star/><div><span>Valoración</span><strong>{dashboard.profile.rating.toFixed(1)}</strong><small>{metrics.completedJobs} completados</small></div></article></div><div className="overview-grid"><section className="panel"><header><div><small>EN CURSO</small><h3>Actividad actual</h3></div><button onClick={() => chooseView("jobs")}>Ver todos</button></header>{activeJobs.length === 0 ? <Empty icon={Wrench} title="No tienes trabajos activos" text="Acepta una oportunidad para comenzar." action="Explorar oportunidades" onAction={() => chooseView("opportunities")}/> : activeJobs.slice(0, 2).map((job) => <ActiveJob key={job.id} job={job} advance={advance} busy={busy === job.id}/>)}</section><section className="panel"><header><div><small>PRÓXIMAS</small><h3>Nuevas oportunidades</h3></div><button onClick={() => chooseView("opportunities")}>Ver {available.length}</button></header>{available.length === 0 ? <Empty icon={BriefcaseBusiness} title="Sin oportunidades nuevas" text="Mantente disponible. Las solicitudes pagadas aparecerán aquí."/> : available.slice(0, 3).map((job) => <button className="mini-opportunity" key={job.id} onClick={() => chooseView("opportunities")}><div><strong>{job.title}</strong><span>{job.category} · {job.address}</span></div><b>€{((job.budgetCents ?? 0) / 100).toFixed(0)}</b><ChevronRight/></button>)}</section></div></>;
}

function Opportunities({ jobs, open }: { jobs: JobSummary[]; open: (job: JobSummary) => void }) { return <section className="page-panel"><div className="page-intro"><div><span>TRABAJOS PAGADOS Y PUBLICADOS</span><h2>Oportunidades para tus servicios</h2><p>Solo ves solicitudes compatibles con las categorías que configuraste.</p></div><div className="result-count"><strong>{jobs.length}</strong><span>disponibles</span></div></div>{jobs.length === 0 ? <Empty icon={BriefcaseBusiness} title="No hay trabajos compatibles ahora" text="Comprueba que tus servicios estén configurados y activa tu disponibilidad."/> : <div className="opportunity-grid">{jobs.map((job) => <article key={job.id}><header><span>{job.category}</span><b>€{((job.budgetCents ?? 0) / 100).toFixed(2)}</b></header><h3>{job.title}</h3><p>{job.description}</p><div className="job-info"><span><MapPin/> {job.address}</span><span><Clock3/> Publicado recientemente</span><span><ShieldCheck/> Pago confirmado</span></div><button onClick={() => open(job)}>Ver detalles y aceptar <ChevronRight/></button></article>)}</div>}</section>; }

function JobsPanel({ active, past, advance, busy }: { active: JobSummary[]; past: JobSummary[]; advance: (job: JobSummary) => void; busy: string }) { return <section className="page-panel"><div className="page-intro"><div><span>GESTIÓN OPERATIVA</span><h2>Mis trabajos</h2><p>Actualiza cada etapa para mantener informado al Cliente.</p></div></div><div className="job-tabs"><strong>Activos ({active.length})</strong></div>{active.length === 0 ? <Empty icon={Wrench} title="No tienes trabajos activos" text="Los trabajos que aceptes aparecerán aquí."/> : <div className="active-list">{active.map((job) => <ActiveJob key={job.id} job={job} advance={advance} busy={busy === job.id}/>)}</div>}<div className="history-title"><h3>Historial</h3><span>{past.length} trabajos</span></div>{past.length === 0 ? <p className="muted">Todavía no hay trabajos finalizados.</p> : <div className="history-table"><div className="history-row head"><span>Trabajo</span><span>Cliente</span><span>Importe</span><span>Estado</span></div>{past.map((job) => <div className="history-row" key={job.id}><span><strong>{job.title}</strong><small>{job.category}</small></span><span>{job.client?.name ?? "Cliente"}</span><span>€{((job.budgetCents ?? 0) / 100).toFixed(2)}</span><span className="status-pill">{statusLabel[job.status] ?? job.status}</span></div>)}</div>}</section>; }

function ServicesPanel({ categories, selected, setSelected, save, busy }: { categories: ServiceCategory[]; selected: string[]; setSelected: (ids: string[]) => void; save: () => void; busy: boolean }) { function toggle(id: string) { setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]); } return <section className="page-panel"><div className="page-intro"><div><span>CATÁLOGO PROFESIONAL</span><h2>Servicios que ofrezco</h2><p>Elige una o varias categorías. Solo recibirás trabajos relacionados con esta selección.</p></div><button className="save-button" disabled={busy || selected.length === 0} onClick={save}><Save/> {busy ? "Guardando..." : "Guardar servicios"}</button></div><div className="service-grid">{categories.map((category) => { const checked = selected.includes(category.id); return <button type="button" key={category.id} className={checked ? "selected" : ""} onClick={() => toggle(category.id)}><div className="service-icon"><Wrench/></div><span><strong>{category.names.es}</strong><small>{category.description}</small></span><i>{checked ? <Check/> : <Plus/>}</i></button>; })}</div><div className="service-note"><ShieldCheck/><div><strong>{selected.length} servicios seleccionados</strong><p>La Administración puede revisar cambios importantes en tu oferta profesional.</p></div></div></section>; }

function ProfileForm({ dashboard, save, busy }: { dashboard: ProDashboard; save: (event: React.FormEvent<HTMLFormElement>) => void; busy: boolean }) { const profile = dashboard.profile; return <form className="profile-form" onSubmit={save}><section><header><UserRound/><div><h3>Identidad profesional</h3><p>Información visible para los clientes.</p></div></header><div className="form-grid"><label>Nombre completo<input name="name" defaultValue={profile.name} required/></label><label>Nombre comercial<input name="businessName" defaultValue={profile.businessName ?? ""} placeholder="Ej. Louis Home Services"/></label><label>Profesión<input name="profession" defaultValue={profile.profession} required/></label><label>Teléfono<input name="phone" defaultValue={profile.phone ?? ""} placeholder="+32 ..."/></label><label className="wide">Presentación<textarea name="bio" defaultValue={profile.bio ?? ""} placeholder="Explica tu experiencia, especialidades y forma de trabajar."/></label></div></section><section><header><Settings2/><div><h3>Configuración del negocio</h3><p>Tarifas, experiencia y cobertura de servicio.</p></div></header><div className="form-grid"><label>Número VAT<input name="vatNumber" defaultValue={profile.vatNumber ?? ""} placeholder="BE0123456789"/></label><label>Años de experiencia<input name="yearsExperience" type="number" min="0" max="80" defaultValue={profile.yearsExperience}/></label><label>Tarifa por hora (€)<input name="hourlyRate" type="number" min="0" step="1" defaultValue={profile.hourlyRateCents ? profile.hourlyRateCents / 100 : 45}/></label><label>Zona principal<input name="serviceArea" defaultValue={profile.serviceArea}/></label><label>Radio de trabajo (km)<input name="serviceRadiusKm" type="number" min="1" max="150" defaultValue={profile.serviceRadiusKm}/></label></div></section><footer><button className="save-button" disabled={busy}><Save/> {busy ? "Guardando..." : "Guardar perfil"}</button></footer></form>; }

function ActiveJob({ job, advance, busy }: { job: JobSummary; advance: (job: JobSummary) => void; busy: boolean }) { const action = job.status === "ASSIGNED" ? "Voy en camino" : job.status === "PRO_EN_ROUTE" ? "Iniciar trabajo" : "Completar trabajo"; return <article className="active-job"><div className="job-status-icon"><Wrench/></div><div className="active-job-main"><span>{job.category} · {statusLabel[job.status] ?? job.status}</span><h4>{job.title}</h4><p><MapPin/> {job.address}</p><div className="progress-steps"><i className="done"/><i className={job.status !== "ASSIGNED" ? "done" : ""}/><i className={job.status === "IN_PROGRESS" ? "done" : ""}/></div></div><div className="active-job-action"><strong>€{((job.budgetCents ?? 0) / 100).toFixed(2)}</strong><button disabled={busy} onClick={() => advance(job)}>{busy ? "Actualizando..." : action}</button></div></article>; }
function Empty({ icon: Icon, title, text, action, onAction }: { icon: typeof Wrench; title: string; text: string; action?: string; onAction?: () => void }) { return <div className="pro-empty"><Icon/><strong>{title}</strong><p>{text}</p>{action && <button onClick={onAction}>{action}</button>}</div>; }
function JobModal({ job, close, accept, busy }: { job: JobSummary; close: () => void; accept: (id: string) => void; busy: boolean }) { return <div className="job-modal"><section><button className="modal-close" onClick={close}><X/></button><span>OPORTUNIDAD CONFIRMADA</span><h2>{job.title}</h2><p>{job.description}</p><div className="modal-details"><div><MapPin/><span><small>Dirección</small><strong>{job.address}</strong></span></div><div><UserRound/><span><small>Cliente</small><strong>{job.client?.name ?? "Cliente FIX MY"}</strong></span></div><div><CircleDollarSign/><span><small>Importe garantizado</small><strong>€{((job.budgetCents ?? 0) / 100).toFixed(2)}</strong></span></div></div><div className="payment-confirm"><ShieldCheck/><span><strong>Pago confirmado</strong><small>Esta solicitud ya fue pagada por el cliente.</small></span></div><button className="accept-button" disabled={busy} onClick={() => accept(job.id)}>{busy ? "Asignando..." : "Aceptar trabajo"}</button></section></div>; }
