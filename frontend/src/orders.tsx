import { useEffect, useState, type FormEvent } from "react";
import { Plus, Eye, Check, Download, X, Trash2 } from "lucide-react";
import { Decimal } from "decimal.js";
import { get, send, choices, cop, date } from "./api";
import {
  DownloadLink,
  PageTitle,
  Modal,
  Loading,
  Empty,
  ErrorBox,
  SearchBox,
  Pager,
  Badge,
  type User,
  type Notify,
} from "./components";
export function Orders({
  type,
  user,
  notify,
}: {
  type: "sales" | "purchases";
  user: User;
  notify: Notify;
}) {
  const sale = type === "sales";
  const [data, setData] = useState<any>(null),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [error, setError] = useState<any>(null),
    [creating, setCreating] = useState(false),
    [detail, setDetail] = useState<any>(null),
    [cancel, setCancel] = useState<any>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const write = user.permissions.includes(`${type}.write`);
  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    const timer = setTimeout(
      () =>
        get(
          `/${type}?page=${page}&q=${encodeURIComponent(q)}&status=${status}${from ? "&from=" + from : ""}${to ? "&to=" + to : ""}`,
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
  }, [type, q, status, page, revision, from, to]);
  async function show(row: any) {
    try {
      setDetail((await get(`/${type}/${row.id}`)).data);
    } catch (e) {
      setError(e);
    }
  }
  async function change(row: any, action: string) {
    if (
      action !== "cancel" &&
      !window.confirm(
        `${sale ? "Confirmar venta y descontar" : "Recibir compra y aumentar"} inventario de la operación #${row.id}?`,
      )
    )
      return;
    setBusy(true);
    try {
      const r = await send(
        `/${type}/${row.id}/${action}`,
        action === "cancel" ? { reason } : undefined,
      );
      setRevision((v) => v + 1);
      if (detail?.id === row.id) setDetail(r.data);
      setCancel(null);
      notify("Operación actualizada.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title={sale ? "Ventas" : "Compras"}
        description={
          sale
            ? "Registra ventas y mantén el inventario sincronizado."
            : "Del pedido a la recepción, con trazabilidad completa."
        }
      >
        {write && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={17} /> Nueva {sale ? "venta" : "compra"}
          </button>
        )}
      </PageTitle>
      <ErrorBox error={error} />
      <section className="surface">
        <div className="table-toolbar flex-wrap">
          <SearchBox
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder={sale ? "Buscar cliente…" : "Buscar proveedor…"}
          />
          <select
            className="form-select compact-select"
            aria-label="Estado de operación"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="draft">Borradores</option>
            <option value={sale ? "confirmed" : "received"}>
              {sale ? "Confirmadas" : "Recibidas"}
            </option>
            <option value="cancelled">Anuladas</option>
          </select>
          <label className="date-filter">
            Desde
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="date-filter">
            Hasta
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        {!data && !error ? (
          <Loading />
        ) : data?.data.length ? (
          <>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Operación</th>
                    <th>{sale ? "Cliente" : "Proveedor"}</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((r: any) => (
                    <tr key={r.id}>
                      <td>
                        <strong>
                          {sale ? "VTA" : "CMP"}-{String(r.id).padStart(5, "0")}
                        </strong>
                      </td>
                      <td>{r.party_name}</td>
                      <td className="text-secondary">{date(r.created_at)}</td>
                      <td className="money">{cop(r.total)}</td>
                      <td>
                        <Badge value={r.status} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={`Ver operación ${r.id}`}
                            onClick={() => show(r)}
                          >
                            <Eye size={17} />
                          </button>
                          <DownloadLink
                            className="icon-button"
                            aria-label={`Comprobante ${r.id}`}
                            href={`/api/${type}/${r.id}/receipt`}
                          >
                            <Download size={16} />
                          </DownloadLink>
                          {write && (
                            <>
                              {r.status === "draft" && (
                                <button
                                  className="icon-button"
                                  disabled={busy}
                                  aria-label={
                                    sale ? "Confirmar venta" : "Recibir compra"
                                  }
                                  onClick={() =>
                                    change(r, sale ? "confirm" : "receive")
                                  }
                                >
                                  <Check size={17} />
                                </button>
                              )}
                              {r.status !== "cancelled" && (
                                <button
                                  className="icon-button danger"
                                  disabled={busy}
                                  aria-label={`Anular operación ${r.id}`}
                                  onClick={() => {
                                    setReason("");
                                    setCancel(r);
                                  }}
                                >
                                  <X size={17} />
                                </button>
                              )}
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
      {creating && (
        <OrderForm
          type={type}
          onClose={() => setCreating(false)}
          onSaved={(r) => {
            setCreating(false);
            setDetail(r);
            setRevision((v) => v + 1);
            notify(
              "Borrador registrado. Confirma la operación para aplicar inventario.",
            );
          }}
        />
      )}
      {detail && (
        <Modal
          title={`${sale ? "Venta" : "Compra"} #${detail.id}`}
          onClose={() => setDetail(null)}
          wide
        >
          <div className="modal-content-body">
            <ErrorBox error={error} />
            <div className="detail-line">
              <div>
                <strong>{detail.party_name}</strong>
                <p className="text-secondary">
                  {date(detail.created_at)} · {detail.user_name}
                </p>
              </div>
              <Badge value={detail.status} />
            </div>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((i: any) => (
                    <tr key={i.id}>
                      <td>{i.product_name}</td>
                      <td>{i.quantity}</td>
                      <td>{cop(i.unit_price)}</td>
                      <td>{cop(i.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="order-total">
              Total <strong>{cop(detail.total)}</strong>
            </p>
            {detail.cancel_reason && (
              <p>Motivo de anulación: {detail.cancel_reason}</p>
            )}
          </div>
          <footer className="modal-footer">
            <DownloadLink
              className="btn btn-light"
              href={`/api/${type}/${detail.id}/receipt`}
            >
              <Download size={16} /> Comprobante PDF
            </DownloadLink>
            {write && detail.status === "draft" && (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => change(detail, sale ? "confirm" : "receive")}
              >
                {busy
                  ? "Procesando…"
                  : sale
                    ? "Confirmar venta"
                    : "Recibir mercancía"}
              </button>
            )}
          </footer>
        </Modal>
      )}
      {cancel && (
        <Modal title="Anular operación" onClose={() => setCancel(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void change(cancel, "cancel");
            }}
          >
            <div className="modal-content-body">
              <ErrorBox error={error} />
              <p>
                Se revertirán los movimientos aplicados. Una compra recibida
                solo puede anularse si hay existencias suficientes.
              </p>
              <label className="d-block">
                Motivo obligatorio
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
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setCancel(null)}
              >
                Volver
              </button>
              <button
                className="btn btn-danger"
                disabled={busy || !reason.trim()}
              >
                Anular operación
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
function OrderForm({
  type,
  onClose,
  onSaved,
}: {
  type: "sales" | "purchases";
  onClose: () => void;
  onSaved: (r: any) => void;
}) {
  const sale = type === "sales";
  const [parties, setParties] = useState<any[]>([]),
    [products, setProducts] = useState<any[]>([]),
    [party, setParty] = useState(""),
    [items, setItems] = useState<any[]>([
      { product_id: "", quantity: 1, unit_price: "0.00" },
    ]),
    [error, setError] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  useEffect(() => {
    Promise.all([
      choices(sale ? "customers" : "suppliers"),
      choices("products"),
    ])
      .then(([a, b]) => {
        setParties(a);
        setProducts(b);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [type]);
  function update(index: number, field: string, value: any) {
    setItems((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, [field]: value };
        if (field === "product_id") {
          const p = products.find((p) => p.id === Number(value));
          next.unit_price = p
            ? sale
              ? p.sale_price
              : p.purchase_price
            : "0.00";
        }
        return next;
      }),
    );
  }
  const subtotal = (i: any) => {
    try {
      return new Decimal(i.unit_price || 0).times(i.quantity || 0);
    } catch {
      return new Decimal(0);
    }
  };
  const total = items.reduce((a, i) => a.plus(subtotal(i)), new Decimal(0));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await send("/" + type, {
        party_id: Number(party),
        request_key: key,
        items: items.map((i) => ({
          product_id: Number(i.product_id),
          quantity: Number(i.quantity),
          ...(!sale ? { unit_price: i.unit_price } : {}),
        })),
      });
      onSaved(r.data);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Nueva ${sale ? "venta" : "compra"}`} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="modal-content-body">
          <ErrorBox error={error} />
          {loading ? (
            <Loading />
          ) : (
            <>
              <label className="d-block mb-4">
                {sale ? "Cliente" : "Proveedor"} *
                <select
                  className="form-select mt-2"
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.identification}
                    </option>
                  ))}
                </select>
              </label>
              <div className="order-lines">
                {items.map((item, index) => (
                  <div className="order-line" key={index}>
                    <label>
                      Producto
                      <select
                        className="form-select"
                        required
                        value={item.product_id}
                        onChange={(e) =>
                          update(index, "product_id", e.target.value)
                        }
                      >
                        <option value="">Seleccionar…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · stock {p.stock}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Cantidad
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        max={1000000}
                        required
                        value={item.quantity}
                        onChange={(e) =>
                          update(index, "quantity", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Precio COP
                      <input
                        className="form-control"
                        type="text"
                        inputMode="decimal"
                        required
                        pattern="(0|[1-9][0-9]*)([.][0-9]{1,2})?"
                        readOnly={sale}
                        value={item.unit_price}
                        onChange={(e) =>
                          update(index, "unit_price", e.target.value)
                        }
                      />
                    </label>
                    <div className="line-subtotal">
                      {cop(subtotal(item).toFixed(2))}
                    </div>
                    <button
                      className="icon-button danger"
                      type="button"
                      aria-label="Quitar producto"
                      disabled={items.length === 1}
                      onClick={() =>
                        setItems(items.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-light mt-3"
                disabled={items.length >= 100}
                onClick={() =>
                  setItems([
                    ...items,
                    { product_id: "", quantity: 1, unit_price: "0.00" },
                  ])
                }
              >
                <Plus size={16} /> Agregar producto
              </button>
              <p className="order-total mt-4">
                Total <strong>{cop(total.toFixed(2))}</strong>
              </p>
              <p className="form-note">
                Se guardará un borrador.{" "}
                {sale
                  ? "El precio de venta vigente lo valida el servidor; el inventario se descuenta al confirmar."
                  : "La mercancía ingresa al inventario cuando registres su recepción."}{" "}
                Moneda: COP. Sin impuestos ni descuentos.
              </p>
            </>
          )}
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy || loading}>
            {busy ? "Guardando…" : "Guardar borrador"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
