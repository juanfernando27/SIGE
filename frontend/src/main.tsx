import React, { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  Link,
} from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Shapes,
  Users,
  Truck,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Files,
  ChartNoAxesCombined,
  ShieldCheck,
  Bell,
  LogOut,
  Menu,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Settings2,
  ChevronRight,
  Command,
  UserRound,
  X,
} from "lucide-react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";
import { get, send } from "./api";
import { ErrorBox, Loading, Badge, PageTitle, type User } from "./components";
import { Catalog } from "./catalog";
import { Orders } from "./orders";
const Dashboard = React.lazy(() =>
  import("./dashboard").then((m) => ({ default: m.Dashboard })),
);
import { Inventory, Documents, Reports, Activity } from "./operations";
const nav = [
  {
    label: "PRINCIPAL",
    items: [["/", "Dashboard", LayoutDashboard, "dashboard.read"]],
  },
  {
    label: "GESTIÓN COMERCIAL",
    items: [
      ["/products", "Productos", Package, "products.read"],
      ["/categories", "Categorías", Shapes, "categories.read"],
      ["/customers", "Clientes", Users, "customers.read"],
      ["/suppliers", "Proveedores", Truck, "suppliers.read"],
    ],
  },
  {
    label: "OPERACIONES",
    items: [
      ["/inventory", "Inventario", Boxes, "inventory.read"],
      ["/sales", "Ventas", ShoppingCart, "sales.read"],
      ["/purchases", "Compras", ShoppingBag, "purchases.read"],
      ["/documents", "Documentos", Files, ""],
    ],
  },
  {
    label: "ADMINISTRACIÓN",
    items: [
      ["/reports", "Reportes", ChartNoAxesCombined, "reports.read"],
      ["/users", "Usuarios", UserRound, "users.read"],
      ["/audit", "Auditoría", ShieldCheck, "audit.read"],
    ],
  },
];
function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [toast, setToast] = useState("");
  const notify = (s: string) => setToast(s);
  useEffect(() => {
    get("/auth/me")
      .then((v) => setUser(v.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    const expire = () => setUser(null);
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  if (loading)
    return (
      <div className="app-loading">
        <Brand />
        <Loading />
      </div>
    );
  return (
    <BrowserRouter>
      {user ? (
        <Workspace user={user} onLogout={() => setUser(null)} notify={notify} />
      ) : (
        <Login onLogin={setUser} />
      )}{" "}
      {toast && (
        <div className="toast-message" role="status">
          <CheckCircle2 size={20} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Cerrar aviso">
            <X size={16} />
          </button>
        </div>
      )}
    </BrowserRouter>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <Command size={25} strokeWidth={2.2} />
      </span>
      <span>
        SIGE<small>GESTIÓN EMPRESARIAL</small>
      </span>
    </div>
  );
}
function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("admin@sige.local"),
    [password, setPassword] = useState(""),
    [error, setError] = useState<any>(null),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send("/auth/login", { email, password });
      onLogin((await get("/auth/me")).data);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <div className="login-kicker">
            <span className="status-dot" /> TU EMPRESA, EN SINCRONÍA
          </div>
          <h1>
            Más claridad.
            <br />
            Mejores decisiones.
          </h1>
          <p>
            Conecta tus ventas, compras e inventario.
            <br />
            Haz espacio para lo que sigue.
          </p>
          <div className="login-illustration">
            <div className="illustration-grid" />
            <div className="illustration-card">
              <span>OPERACIÓN CONECTADA</span>
              <div className="illustration-chart">
                {[25, 40, 33, 65, 55, 85, 73, 100].map((h, i) => (
                  <i key={i} style={{ height: h + "%" }} />
                ))}
              </div>
              <div className="illustration-card-footer">
                <CheckCircle2 size={17} /> Cada movimiento cuenta.
              </div>
            </div>
            <div className="floating-label">
              <Boxes size={20} />
              <div>
                Todo en un lugar<small>Personas, productos y operaciones</small>
              </div>
            </div>
          </div>
        </div>
        <footer>
          Sistema Integral de Gestión Empresarial <span>01 / SIGE</span>
        </footer>
      </section>
      <section className="login-form-area">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <form className="login-form" onSubmit={submit}>
          <span className="login-icon">
            <LockKeyhole size={23} />
          </span>
          <div className="eyebrow">BIENVENIDO A TU ESPACIO</div>
          <h2>Inicia sesión</h2>
          <p>Ingresa tus credenciales para continuar.</p>
          <ErrorBox error={error} />
          <label>
            Correo electrónico
            <input
              className="form-control"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              className="form-control"
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn btn-primary login-submit" disabled={busy}>
            {busy ? "Verificando…" : "Entrar a SIGE"}
            <ArrowRight size={18} />
          </button>
          <div className="login-security">
            <ShieldCheck size={15} /> Acceso seguro según tu rol
          </div>
          <p className="demo-note">
            Primera instalación: crea los datos de demostración y consulta las
            credenciales en README.md.
          </p>
        </form>
        <footer>Organiza. Conecta. Avanza.</footer>
      </section>
    </main>
  );
}
function Workspace({
  user,
  onLogout,
  notify,
}: {
  user: User;
  onLogout: () => void;
  notify: (s: string) => void;
}) {
  const location = useLocation(),
    [mobile, setMobile] = useState(false),
    [unread, setUnread] = useState(0),
    [error, setError] = useState<any>(null);
  useEffect(() => setMobile(false), [location.pathname]);
  useEffect(() => {
    let live = true;
    const update = () =>
      get("/notifications?pageSize=1")
        .then((v) => {
          if (live) setUnread(v.meta.unread);
        })
        .catch(() => {});
    void update();
    window.addEventListener("notifications-updated", update);
    return () => {
      live = false;
      window.removeEventListener("notifications-updated", update);
    };
  }, [location.pathname]);
  async function logout() {
    try {
      await send("/auth/logout");
      onLogout();
    } catch (e) {
      setError(e);
    }
  }
  const can = (permission: string, element: React.ReactNode) =>
    !permission || user.permissions.includes(permission) ? (
      element
    ) : (
      <Navigate to="/" replace />
    );
  const title =
    location.pathname === "/"
      ? "Dashboard"
      : nav
          .flatMap((g) => g.items)
          .find((i) => i[0] === location.pathname)?.[1] ||
        (location.pathname === "/profile" ? "Mi perfil" : "Notificaciones");
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-shade"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <Link to="/" className="brand-link">
          <Brand />
        </Link>
        <div className="workspace-switch">
          <span className="company-avatar">S</span>
          <div>
            Mi empresa<small>Espacio de trabajo</small>
          </div>
          <Settings2 size={15} />
        </div>
        <nav aria-label="Menú principal">
          {nav.map((group) => {
            const visible = group.items.filter(
              (i) => !i[3] || user.permissions.includes(String(i[3])),
            );
            return visible.length ? (
              <div className="nav-group" key={group.label}>
                <div className="nav-label">{group.label}</div>
                {visible.map((item) => {
                  const [path, label, Icon] = item as [
                    string,
                    string,
                    typeof Package,
                    string,
                  ];
                  return (
                    <NavLink
                      end={path === "/"}
                      to={path}
                      key={path}
                      className={({ isActive }) =>
                        "nav-item " + (isActive ? "active" : "")
                      }
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                      {path === "/" && <span className="active-dot" />}
                    </NavLink>
                  );
                })}
              </div>
            ) : null;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="status-dot" /> Gestión conectada
          </div>
          <div className="user-card">
            <Link to="/profile">
              <span className="user-avatar">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>{user.name}</strong>
                <small>{user.role}</small>
              </span>
            </Link>
            <button onClick={logout} aria-label="Cerrar sesión">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={21} />
            </button>
            <span>Mi empresa</span>
            <ChevronRight size={14} />
            <strong>{String(title)}</strong>
          </div>
          <div className="topbar-right">
            <span className="today">
              {new Intl.DateTimeFormat("es-CO", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date())}
            </span>
            <Link
              className="notification-button"
              to="/notifications"
              aria-label={`Notificaciones: ${unread} sin leer`}
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </Link>
            <Link
              className="topbar-avatar"
              to="/profile"
              aria-label="Mi perfil"
            >
              {user.name[0]}
            </Link>
          </div>
        </header>
        <main className="main-content">
          <ErrorBox error={error} />
          <React.Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Dashboard user={user} />} />
              {[
                "products",
                "categories",
                "customers",
                "suppliers",
                "users",
              ].map((entity) => (
                <Route
                  key={entity}
                  path={"/" + entity}
                  element={can(
                    entity + ".read",
                    <Catalog
                      key={entity}
                      entity={entity}
                      user={user}
                      notify={notify}
                    />,
                  )}
                />
              ))}
              {(["sales", "purchases"] as const).map((type) => (
                <Route
                  key={type}
                  path={"/" + type}
                  element={can(
                    type + ".read",
                    <Orders
                      key={type}
                      type={type}
                      user={user}
                      notify={notify}
                    />,
                  )}
                />
              ))}
              <Route
                path="/inventory"
                element={can(
                  "inventory.read",
                  <Inventory user={user} notify={notify} />,
                )}
              />
              <Route
                path="/documents"
                element={<Documents user={user} notify={notify} />}
              />
              <Route
                path="/reports"
                element={can("reports.read", <Reports />)}
              />
              <Route
                path="/audit"
                element={can(
                  "audit.read",
                  <Activity key="audit" kind="audit" notify={notify} />,
                )}
              />
              <Route
                path="/notifications"
                element={
                  <Activity
                    key="notifications"
                    kind="notifications"
                    notify={notify}
                  />
                }
              />
              <Route
                path="/profile"
                element={<Profile user={user} onLogout={onLogout} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}
function Profile({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [error, setError] = useState<any>(null),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send("/auth/password", { current, next }, "PUT");
      onLogout();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Mi perfil"
        description="Tu cuenta y la seguridad de tus sesiones."
      />
      <section className="surface p-4 profile-card">
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <Badge value={user.role} />
        <hr />
        <h3>Cambiar contraseña</h3>
        <p className="text-secondary">
          Al guardarla, se cerrarán todas las sesiones de tu cuenta.
        </p>
        <ErrorBox error={error} />
        <form onSubmit={submit} className="profile-form">
          <label>
            Contraseña actual
            <input
              className="form-control"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label>
            Nueva contraseña
            <input
              className="form-control"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Guardando…" : "Actualizar contraseña"}
          </button>
        </form>
      </section>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
