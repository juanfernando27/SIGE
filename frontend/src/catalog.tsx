import { useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Power, Eye } from "lucide-react";
import { get, send, choices, cop, date } from "./api";
import {
  Modal,
  ErrorBox,
  Loading,
  Empty,
  SearchBox,
  Pager,
  Badge,
  PageTitle,
  type User,
  type Notify,
} from "./components";
type Field = {
  key: string;
  label: string;
  type?: string;
  max?: number;
  required?: boolean;
  options?: string;
};
const status: Field = { key: "status", label: "Estado", options: "status" };
const party: Field[] = [
  {
    key: "identification",
    label: "Identificación / NIT",
    required: true,
    max: 40,
  },
  { key: "name", label: "Nombre o razón social", required: true, max: 120 },
  { key: "phone", label: "Teléfono", max: 40 },
  { key: "email", label: "Correo electrónico", type: "email", max: 190 },
  { key: "address", label: "Dirección", max: 300 },
  status,
];
export const catalogs: Record<
  string,
  { title: string; singular: string; description: string; fields: Field[] }
> = {
  products: {
    title: "Productos",
    singular: "producto",
    description: "Tu catálogo, precios y disponibilidad en un solo lugar.",
    fields: [
      { key: "code", label: "Código único", required: true, max: 40 },
      { key: "name", label: "Nombre", required: true, max: 140 },
      { key: "description", label: "Descripción", type: "textarea", max: 1000 },
      {
        key: "category_id",
        label: "Categoría",
        required: true,
        options: "categories",
      },
      {
        key: "supplier_id",
        label: "Proveedor principal",
        options: "suppliers",
      },
      {
        key: "purchase_price",
        label: "Precio de compra (COP)",
        type: "money",
        required: true,
      },
      {
        key: "sale_price",
        label: "Precio de venta (COP)",
        type: "money",
        required: true,
      },
      {
        key: "min_stock",
        label: "Stock mínimo",
        type: "number",
        required: true,
      },
      status,
    ],
  },
  categories: {
    title: "Categorías",
    singular: "categoría",
    description: "Organiza los productos de tu empresa.",
    fields: [
      { key: "name", label: "Nombre", required: true, max: 120 },
      { key: "description", label: "Descripción", type: "textarea", max: 1000 },
      status,
    ],
  },
  customers: {
    title: "Clientes",
    singular: "cliente",
    description: "Gestiona tus clientes y consulta su historial de compras.",
    fields: party,
  },
  suppliers: {
    title: "Proveedores",
    singular: "proveedor",
    description: "Mantén al día tus aliados y sus compras relacionadas.",
    fields: party,
  },
  users: {
    title: "Usuarios",
    singular: "usuario",
    description: "Administra las cuentas y los permisos de tu equipo.",
    fields: [
      { key: "name", label: "Nombre completo", required: true, max: 120 },
      {
        key: "email",
        label: "Correo electrónico",
        type: "email",
        required: true,
        max: 190,
      },
      {
        key: "password",
        label: "Contraseña (12 caracteres o más)",
        type: "password",
        max: 128,
      },
      { key: "role_id", label: "Rol", options: "roles", required: true },
      status,
    ],
  },
};
export function Catalog({
  entity,
  user,
  notify,
}: {
  entity: string;
  user: User;
  notify: Notify;
}) {
  const config = catalogs[entity];
  const [data, setData] = useState<any>(null),
    [q, setQ] = useState(""),
    [state, setState] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [error, setError] = useState<any>(null),
    [editing, setEditing] = useState<any>(null),
    [detail, setDetail] = useState<any>(null);
  const write = user.permissions.includes(`${entity}.write`);
  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    const timer = setTimeout(
      () =>
        get(
          `/${entity}?page=${page}&q=${encodeURIComponent(q)}&status=${state}`,
        )
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
  }, [entity, q, state, page, revision]);
  async function deactivate(row: any) {
    if (
      !window.confirm(`¿Desactivar a ${row.name}? El historial se conservará.`)
    )
      return;
    try {
      await send(`/${entity}/${row.id}`, undefined, "DELETE");
      notify("Registro desactivado.");
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e);
    }
  }
  async function show(row: any) {
    try {
      setDetail((await get(`/${entity}/${row.id}`)).data);
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="DIRECTORIO"
        title={config.title}
        description={config.description}
      >
        {write && (
          <button
            className="btn btn-primary"
            onClick={() =>
              setEditing({
                status: "active",
                min_stock: 5,
                purchase_price: "0.00",
                sale_price: "0.00",
              })
            }
          >
            <Plus size={17} /> Nuevo {config.singular}
          </button>
        )}
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
          />
          <select
            className="form-select compact-select"
            aria-label="Filtrar estado"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
        {!data && !error ? (
          <Loading />
        ) : data?.data.length ? (
          <>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>{entity === "products" ? "Producto" : "Nombre"}</th>
                    <th>
                      {entity === "products"
                        ? "Categoría"
                        : entity === "users"
                          ? "Correo"
                          : "Referencia"}
                    </th>
                    {entity === "products" && (
                      <>
                        <th>Precio de venta</th>
                        <th>Existencias</th>
                      </>
                    )}
                    {entity === "users" && <th>Rol</th>}
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row: any) => (
                    <tr key={row.id}>
                      <td>
                        <div className="product-cell">
                          {entity === "products" ? (
                            row.image_document_id ? (
                              <img
                                className="product-photo"
                                alt=""
                                src={`/api/documents/${row.image_document_id}/download?inline=1`}
                              />
                            ) : (
                              <span className="product-avatar">
                                {row.name.slice(0, 2).toUpperCase()}
                              </span>
                            )
                          ) : null}
                          <div>
                            <strong>{row.name}</strong>
                            {entity === "products" && <small>{row.code}</small>}
                          </div>
                        </div>
                      </td>
                      <td className="text-secondary">
                        {entity === "products"
                          ? row.category_name
                          : entity === "users"
                            ? row.email
                            : row.identification || row.description || "—"}
                      </td>
                      {entity === "products" && (
                        <>
                          <td className="money">{cop(row.sale_price)}</td>
                          <td>
                            <span
                              className={
                                row.stock <= row.min_stock
                                  ? "low-stock"
                                  : "stock"
                              }
                            >
                              {row.stock} unidades
                            </span>
                          </td>
                        </>
                      )}
                      {entity === "users" && (
                        <td>
                          <Badge value={row.role} />
                        </td>
                      )}
                      <td>
                        <Badge value={row.status} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={`Ver ${row.name}`}
                            onClick={() => show(row)}
                          >
                            <Eye size={17} />
                          </button>
                          {write && (
                            <>
                              <button
                                className="icon-button"
                                aria-label={`Editar ${row.name}`}
                                onClick={() => setEditing(row)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="icon-button danger"
                                disabled={
                                  row.status === "inactive" ||
                                  (row.id === user.id && entity === "users")
                                }
                                aria-label={`Desactivar ${row.name}`}
                                onClick={() => deactivate(row)}
                              >
                                <Power size={16} />
                              </button>
                            </>
                          )}
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
      {editing && (
        <CatalogForm
          entity={entity}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRevision((v) => v + 1);
            notify("Registro guardado correctamente.");
          }}
        />
      )}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)} wide>
          <div className="modal-content-body">
            <dl className="detail-grid">
              {config.fields
                .filter((f) => f.key !== "password")
                .map((f) => (
                  <div key={f.key}>
                    <dt>{f.label}</dt>
                    <dd>
                      {f.type === "money"
                        ? cop(detail[f.key])
                        : String(detail[f.key] ?? "—")}
                    </dd>
                  </div>
                ))}
            </dl>
            {["sales", "purchases", "products"].map(
              (key) =>
                detail[key] && (
                  <div key={key}>
                    <h3>
                      {key === "sales"
                        ? "Historial de compras del cliente"
                        : key === "purchases"
                          ? "Compras al proveedor"
                          : "Productos asociados"}
                    </h3>
                    {detail[key].length ? (
                      <div className="table-responsive">
                        <table className="table">
                          <tbody>
                            {detail[key].map((r: any) => (
                              <tr key={r.id}>
                                <td>#{r.id}</td>
                                <td>{r.name || date(r.created_at)}</td>
                                <td>{r.total ? cop(r.total) : r.code}</td>
                                <td>
                                  {r.status && <Badge value={r.status} />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty />
                    )}
                  </div>
                ),
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
function CatalogForm({
  entity,
  initial,
  onClose,
  onSaved,
}: {
  entity: string;
  initial: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = catalogs[entity];
  const [values, setValues] = useState<any>(initial),
    [opts, setOpts] = useState<Record<string, any[]>>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<any>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all(
      c.fields
        .filter((f) => f.options && f.options !== "status")
        .map(
          async (f) =>
            [
              f.options,
              f.options === "roles"
                ? (await get("/roles")).data
                : await choices(f.options!),
            ] as const,
        ),
    )
      .then((entries) => {
        if (live) setOpts(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (live) setError(e);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [entity]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: any = {};
    for (const f of c.fields) {
      let value = values[f.key] ?? "";
      if (f.key === "password" && !value && initial.id) continue;
      if (f.type === "number" || f.key.endsWith("_id"))
        value = value === "" ? null : Number(value);
      body[f.key] = value;
    }
    try {
      await send(
        `/${entity}${initial.id ? "/" + initial.id : ""}`,
        body,
        initial.id ? "PUT" : "POST",
      );
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${initial.id ? "Editar" : "Nuevo"} ${c.singular}`}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="modal-content-body">
          <ErrorBox error={error} />
          {loading ? (
            <Loading />
          ) : (
            <div className="form-grid">
              {c.fields.map((f) => (
                <label
                  key={f.key}
                  className={f.type === "textarea" ? "full" : ""}
                >
                  <span>
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                  {f.options ? (
                    <select
                      className="form-select"
                      required={f.required}
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                    >
                      <option value="">Seleccionar…</option>
                      {f.options === "status" ? (
                        <>
                          <option value="active">Activo</option>
                          <option value="inactive">Inactivo</option>
                        </>
                      ) : (
                        (opts[f.options] || []).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))
                      )}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      className="form-control"
                      rows={3}
                      maxLength={f.max}
                      value={values[f.key] || ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      className="form-control"
                      autoComplete={
                        f.type === "password" ? "new-password" : "off"
                      }
                      type={f.type === "money" ? "text" : f.type || "text"}
                      inputMode={f.type === "money" ? "decimal" : undefined}
                      pattern={
                        f.type === "money"
                          ? "(0|[1-9][0-9]*)([.][0-9]{1,2})?"
                          : undefined
                      }
                      min={f.type === "number" ? 0 : undefined}
                      minLength={f.type === "password" ? 12 : undefined}
                      maxLength={f.max}
                      required={
                        f.required || (f.type === "password" && !initial.id)
                      }
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                    />
                  )}
                </label>
              ))}
            </div>
          )}
          <p className="form-note">
            {entity === "products"
              ? "Registra las existencias desde Compras o Ajustes de inventario. Los precios usan punto decimal, sin separador de miles."
              : "Los campos con * son obligatorios."}
          </p>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy || loading}>
            {busy ? "Guardando…" : "Guardar registro"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
