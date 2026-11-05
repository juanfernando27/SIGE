import { download } from "./api";
import { useEffect, useState, useId, type ReactNode } from "react";
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Inbox,
} from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const id = useId();
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", handle);
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop-custom"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={"modal-panel " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <header>
          <h2 id={id}>{title}</h2>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function ErrorBox({ error }: { error: any }) {
  return error ? (
    <div className="alert alert-danger" role="alert">
      {error.message || String(error)}
      {error.details?.length > 0 && (
        <ul className="mb-0 mt-2">
          {error.details.map((v: any, i: number) => (
            <li key={i}>
              {v.field}: {v.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="state">
      <LoaderCircle className="spin" size={26} />
      <span>Cargando información…</span>
    </div>
  );
}
export function Empty({
  text = "No hay registros para mostrar.",
}: {
  text?: string;
}) {
  return (
    <div className="state">
      <Inbox size={30} />
      <span>{text}</span>
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Buscar registros…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="searchbox">
      <Search size={17} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
export function Pager({
  meta,
  onPage,
}: {
  meta: any;
  onPage: (v: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  return (
    <div className="pager">
      <span>
        {meta.total} registros · Página {meta.page} de {pages}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Página anterior"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Página siguiente"
          disabled={meta.page >= pages}
          onClick={() => onPage(meta.page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
export const labels: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  draft: "Borrador",
  confirmed: "Confirmada",
  received: "Recibida",
  cancelled: "Anulada",
  administrador: "Administrador",
  vendedor: "Vendedor",
  inventario: "Inventario",
};
export function Badge({ value }: { value: string }) {
  return (
    <span className={"badge-status " + value}>{labels[value] || value}</span>
  );
}
export function PageTitle({
  eyebrow = "OPERACIÓN",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  role_id: number;
  permissions: string[];
}
export type Notify = (message: string) => void;

export function DownloadLink({
  href,
  children,
  ...props
}: {
  href: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <a
        {...props}
        href={href}
        aria-busy={busy}
        onClick={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await download(href.replace(/^\/api/, ""));
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo descargar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {children}
      </a>
      {error && (
        <span className="text-danger" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
