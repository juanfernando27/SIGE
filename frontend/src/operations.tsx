import { useEffect, useState, type FormEvent } from "react";
import { Plus, Download, Trash2, Upload, CheckCheck } from "lucide-react";
import { get, send, request, choices, cop, date } from "./api";
import {
  DownloadLink,
  PageTitle,
  Modal,
  ErrorBox,
  Loading,
  Empty,
  SearchBox,
  Pager,
  type User,
  type Notify,
} from "./components";
export function Inventory({ user, notify }: { user: User; notify: Notify }) {
  const [tab, setTab] = useState("stock"),
    [data, setData] = useState<any>(null),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [low, setLow] = useState(false),
    [editing, setEditing] = useState(false),
    [revision, setRevision] = useState(0),
    [error, setError] = useState<any>(null);
  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    const endpoint =
      tab === "movements"
        ? "/inventory/movements"
        : low
          ? "/products/low-stock"
          : "/inventory";
    const timer = setTimeout(
      () =>
        get(`${endpoint}?page=${page}&q=${encodeURIComponent(q)}`)
          .then((v) => {
            if (live) setData(v);
          })
          .catch((e) => {
            if (live) setError(e);
          }),
      200,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, page, tab, revision, low]);
  return (
    <>
      <PageTitle
        title="Inventario"
        description="Cada entrada y salida tiene una razón y un responsable."
      >
        {user.permissions.includes("inventory.write") && (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            <Plus size={17} /> Ajustar inventario
          </button>
        )}
      </PageTitle>
      <ErrorBox error={error} />
      <div className="tabs">
        <button
          className={tab === "stock" ? "selected" : ""}
          onClick={() => {
            setTab("stock");
            setPage(1);
          }}
        >
          Existencias
        </button>
        <button
          className={tab === "movements" ? "selected" : ""}
          onClick={() => {
            setTab("movements");
            setPage(1);
          }}
        >
          Movimientos
        </button>
      </div>
      <section className="surface">
        <div className="table-toolbar">
          <SearchBox
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Buscar producto…"
          />
          {tab === "stock" && (
            <label className="filter-check">
              <input
                type="checkbox"
                checked={low}
                onChange={(e) => {
                  setLow(e.target.checked);
                  setPage(1);
                }}
              />{" "}
              Solo bajo mínimo
            </label>
          )}
        </div>
        {!data && !error ? (
          <Loading />
        ) : data?.data.length ? (
          <>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    {(tab === "stock"
                      ? [
                          "Producto",
                          "Código",
                          "Existencias",
                          "Mínimo",
                          "Última actualización",
                        ]
                      : [
                          "Fecha",
                          "Producto",
                          "Tipo",
                          "Cambio",
                          "Saldo",
                          "Responsable",
                          "Motivo",
                        ]
                    ).map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((r: any) => (
                    <tr key={r.id || r.product_id}>
                      {tab === "stock" ? (
                        <>
                          <td>
                            <strong>{r.name}</strong>
                          </td>
                          <td>{r.code}</td>
                          <td>
                            <span
                              className={
                                r.stock <= r.min_stock ? "low-stock" : "stock"
                              }
                            >
                              {r.stock} unidades
                            </span>
                          </td>
                          <td>{r.min_stock}</td>
                          <td>{date(r.updated_at)}</td>
                        </>
                      ) : (
                        <>
                          <td>{date(r.created_at)}</td>
                          <td>{r.product_name}</td>
                          <td>
                            {(
                              {
                                adjustment: "Ajuste",
                                sale: "Venta",
                                purchase: "Compra",
                                reversal: "Reversión",
                              } as any
                            )[r.kind] || r.kind}
                          </td>
                          <td
                            className={
                              r.quantity < 0 ? "text-danger" : "text-success"
                            }
                          >
                            {r.quantity > 0 ? "+" : ""}
                            {r.quantity}
                          </td>
                          <td>{r.balance}</td>
                          <td>{r.user_name}</td>
                          <td>{r.reason}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager meta={data.meta} onPage={setPage} />
          </>
        ) : (
          data && <Empty />
        )}
      </section>
      {editing && (
        <Adjustment
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setRevision((v) => v + 1);
            notify("Ajuste registrado con su movimiento.");
          }}
        />
      )}
    </>
  );
}
function Adjustment({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [products, setProducts] = useState<any[]>([]),
    [product, setProduct] = useState(""),
    [quantity, setQuantity] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState<any>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    choices("products").then(setProducts).catch(setError);
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send("/inventory/adjustments", {
        product_id: Number(product),
        quantity: Number(quantity),
        reason,
      });
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Ajuste de inventario" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-content-body">
          <ErrorBox error={error} />
          <label className="d-block mb-3">
            Producto
            <select
              className="form-select mt-2"
              required
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · stock {p.stock}
                </option>
              ))}
            </select>
          </label>
          <label className="d-block mb-3">
            Cantidad (+ entrada / − salida)
            <input
              className="form-control mt-2"
              required
              type="number"
              min={-1000000}
              max={1000000}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className="d-block">
            Motivo
            <textarea
              className="form-control mt-2"
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || Number(quantity) === 0}
          >
            Registrar ajuste
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function Documents({ user, notify }: { user: User; notify: Notify }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState<any>(null),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [upload, setUpload] = useState(false);
  useEffect(() => {
    let live = true;
    setData(null);
    get(`/documents?page=${page}&q=${encodeURIComponent(q)}`)
      .then((v) => {
        if (live) setData(v);
      })
      .catch((e) => {
        if (live) setError(e);
      });
    return () => {
      live = false;
    };
  }, [q, page, revision]);
  async function remove(r: any) {
    if (!window.confirm(`¿Eliminar ${r.original_name}?`)) return;
    try {
      await send(`/documents/${r.id}`, undefined, "DELETE");
      setRevision((v) => v + 1);
      notify("Archivo eliminado.");
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <PageTitle
        title="Documentos"
        description="Archivos e imágenes vinculados a tus registros."
      >
        <button className="btn btn-primary" onClick={() => setUpload(true)}>
          <Upload size={17} /> Subir archivo
        </button>
      </PageTitle>
      <ErrorBox error={error} />
      <section className="surface">
        <div className="table-toolbar">
          <SearchBox
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Buscar archivo…"
          />
        </div>
        {!data && !error ? (
          <Loading />
        ) : data?.data.length ? (
          <>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Registro asociado</th>
                    <th>Tamaño</th>
                    <th>Fecha</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((r: any) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.original_name}</strong>
                        <small className="d-block text-secondary">
                          {r.mime_type}
                        </small>
                      </td>
                      <td>
                        {entityLabels[r.entity_type] || r.entity_type} #
                        {r.entity_id}
                      </td>
                      <td>{(r.size_bytes / 1024).toFixed(1)} KB</td>
                      <td>{date(r.created_at)}</td>
                      <td>
                        <div className="row-actions">
                          <DownloadLink
                            className="icon-button"
                            aria-label="Descargar archivo"
                            href={`/api/documents/${r.id}/download`}
                          >
                            <Download size={17} />
                          </DownloadLink>
                          <button
                            className="icon-button danger"
                            aria-label="Eliminar archivo"
                            onClick={() => remove(r)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager meta={data.meta} onPage={setPage} />
          </>
        ) : (
          data && <Empty />
        )}
      </section>
      {upload && (
        <UploadForm
          user={user}
          onClose={() => setUpload(false)}
          onSaved={() => {
            setUpload(false);
            setRevision((v) => v + 1);
            notify("Archivo guardado.");
          }}
        />
      )}
    </>
  );
}
function UploadForm({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const allowed = [
    "products",
    "customers",
    "suppliers",
    "sales",
    "purchases",
  ].filter((t) => user.permissions.includes(t + ".write"));
  const [entity, setEntity] = useState(allowed[0] || ""),
    [id, setId] = useState(""),
    [records, setRecords] = useState<any[]>([]),
    [file, setFile] = useState<File | null>(null),
    [error, setError] = useState<any>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setId("");
    setRecords([]);
    if (entity) choices(entity).then(setRecords).catch(setError);
  }, [entity]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    const body = new FormData();
    body.set("entity_type", entity);
    body.set("entity_id", id);
    body.set("file", file);
    try {
      await request("/documents", { method: "POST", body });
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Subir documento o imagen" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-content-body">
          <ErrorBox error={error} />
          <label className="d-block mb-3">
            Tipo de registro
            <select
              className="form-select mt-2"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
            >
              {allowed.map((t) => (
                <option key={t} value={t}>
                  {
                    (
                      {
                        products: "Productos",
                        customers: "Clientes",
                        suppliers: "Proveedores",
                        sales: "Ventas",
                        purchases: "Compras",
                      } as any
                    )[t]
                  }
                </option>
              ))}
            </select>
          </label>
          <label className="d-block mb-3">
            Registro asociado
            <select
              className="form-select mt-2"
              value={id}
              required
              onChange={(e) => setId(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} · {r.name || r.party_name}
                </option>
              ))}
            </select>
          </label>
          <label className="upload-zone">
            <Upload size={25} />
            <strong>Seleccionar archivo</strong>
            <span>PNG, JPEG o PDF · máximo 5 MB</span>
            <input
              type="file"
              required
              accept="image/png,image/jpeg,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !file || !entity}
          >
            {busy ? "Subiendo…" : "Guardar archivo"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
const entityLabels: Record<string, string> = {
  products: "Productos",
  customers: "Clientes",
  suppliers: "Proveedores",
  sales: "Ventas",
  purchases: "Compras",
};
const reportLabels: Record<string, string> = {
  id: "N.º",
  party: "Cliente / proveedor",
  status: "Estado",
  total: "Total COP",
  created_at: "Fecha",
  code: "Código",
  name: "Producto",
  category: "Categoría",
  stock: "Existencias",
  min_stock: "Mínimo",
  purchase_price: "Compra COP",
  sale_price: "Venta COP",
};
export function Reports() {
  const [kind, setKind] = useState("sales"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [data, setData] = useState<any[] | null>(null),
    [error, setError] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const url = `/reports/${kind}?${from ? "from=" + from + "&" : ""}${to ? "to=" + to + "&" : ""}`;
  useEffect(() => setData(null), [kind, from, to]);
  async function load(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setData((await get(url)).data);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Reportes"
        description="Consulta tus operaciones y descarga información para analizar."
      />
      <ErrorBox error={error} />
      <section className="surface p-4">
        <form onSubmit={load} className="report-controls">
          <label>
            Reporte
            <select
              className="form-select"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="sales">Ventas</option>
              <option value="purchases">Compras</option>
              <option value="inventory">Inventario actual</option>
              <option value="low-stock">Productos bajo mínimo</option>
            </select>
          </label>
          {["sales", "purchases"].includes(kind) && (
            <>
              <label>
                Desde
                <input
                  className="form-control"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  className="form-control"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Consultando…" : "Consultar reporte"}
          </button>
        </form>
        <div className="export-actions">
          <DownloadLink
            className="btn btn-light"
            href={"/api" + url + "format=csv"}
          >
            <Download size={16} /> CSV para Excel
          </DownloadLink>
          <DownloadLink
            className="btn btn-light"
            href={"/api" + url + "format=pdf"}
          >
            <Download size={16} /> Descargar PDF
          </DownloadLink>
        </div>
        <p className="form-note">
          Hasta 10.000 registros por exportación. Ventas y compras incluyen
          todos los estados para facilitar su revisión. El inventario muestra el
          saldo actual.
        </p>
      </section>
      {data &&
        (data.length ? (
          <section className="surface mt-4">
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    {Object.keys(data[0]).map((k) => (
                      <th key={k}>{reportLabels[k] || k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 100).map((r, i) => (
                    <tr key={i}>
                      {Object.entries(r).map(([k, v]) => (
                        <td key={k}>
                          {k.includes("price") || k === "total"
                            ? cop(v)
                            : String(v ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 text-secondary">
              {data.length} registros. Vista previa de las primeras 100 filas.
            </div>
          </section>
        ) : (
          <Empty />
        ))}
    </>
  );
}
export function Activity({
  kind,
  notify,
}: {
  kind: "audit" | "notifications";
  notify: Notify;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState<any>(null),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    get(`/${kind}?page=${page}&q=${encodeURIComponent(q)}`)
      .then((v) => {
        if (live) setData(v);
      })
      .catch((e) => {
        if (live) setError(e);
      });
    return () => {
      live = false;
    };
  }, [kind, page, q, revision]);
  async function read(id: number) {
    try {
      await send(`/notifications/${id}/read`);
      setRevision((v) => v + 1);
      window.dispatchEvent(new Event("notifications-updated"));
      notify("Notificación marcada como leída.");
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <PageTitle
        title={kind === "audit" ? "Auditoría" : "Notificaciones"}
        description={
          kind === "audit"
            ? "Acciones, responsables y cambios registrados por el sistema."
            : "Alertas y eventos importantes para tu operación."
        }
      />
      <ErrorBox error={error} />
      <section className="surface">
        {kind === "audit" && (
          <div className="table-toolbar">
            <SearchBox
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder="Buscar acción…"
            />
          </div>
        )}
        {!data && !error ? (
          <Loading />
        ) : data?.data.length ? (
          <>
            {kind === "audit" ? (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Usuario</th>
                      <th>Acción</th>
                      <th>Registro</th>
                      <th>Resultado</th>
                      <th>Cambios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((r: any) => (
                      <tr key={r.id}>
                        <td>{date(r.created_at)}</td>
                        <td>{r.user_name || "Sin sesión"}</td>
                        <td>{r.action}</td>
                        <td>
                          {r.entity} #{r.entity_id}
                        </td>
                        <td>{r.result}</td>
                        <td>
                          <details>
                            <summary>Ver cambios</summary>
                            <pre className="audit-json">
                              {JSON.stringify(
                                typeof r.changes === "string"
                                  ? JSON.parse(r.changes)
                                  : r.changes,
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="notification-list">
                {data.data.map((r: any) => (
                  <article
                    className={"notification " + (r.read_at ? "read" : "")}
                    key={r.id}
                  >
                    <span
                      className={"status-dot " + (r.read_at ? "muted" : "")}
                    />
                    <div>
                      <h3>{r.title}</h3>
                      <p>{r.message}</p>
                      <small>{date(r.created_at)}</small>
                    </div>
                    {!r.read_at && (
                      <button
                        className="icon-button"
                        aria-label="Marcar como leída"
                        onClick={() => read(r.id)}
                      >
                        <CheckCheck size={18} />
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
            <Pager meta={data.meta} onPage={setPage} />
          </>
        ) : (
          data && <Empty />
        )}
      </section>
    </>
  );
}
