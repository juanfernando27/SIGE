import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowUpRight,
  Package,
  Users,
  ShoppingBag,
  Wallet,
  ArrowRight,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { get, cop, date } from "./api";
import {
  PageTitle,
  ErrorBox,
  Loading,
  Empty,
  Badge,
  type User,
} from "./components";
export function Dashboard({ user }: { user: User }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState<any>(null),
    [period, setPeriod] = useState("30");
  useEffect(() => {
    let live = true;
    setError(null);
    setData(null);
    const from = new Date(Date.now() - (Number(period) - 1) * 86400000)
        .toISOString()
        .slice(0, 10),
      to = new Date().toISOString().slice(0, 10);
    get(`/dashboard?from=${from}&to=${to}`)
      .then((v) => {
        if (live) setData(v.data);
      })
      .catch((e) => {
        if (live) setError(e);
      });
    return () => {
      live = false;
    };
  }, [period]);
  const can = (p: string) => user.permissions.includes(p);
  return (
    <>
      <PageTitle
        eyebrow="VISIÓN GENERAL"
        title="Todo tu negocio, conectado."
        description="Una mirada clara a lo que está pasando en tu empresa."
      >
        <select
          className="form-select period-select"
          aria-label="Período del dashboard"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
          <option value="365">Último año</option>
        </select>
        {can("sales.write") && (
          <Link to="/sales" className="btn btn-primary">
            <Plus size={17} /> Registrar venta
          </Link>
        )}
      </PageTitle>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stat-grid">
              {[
                {
                  label: "Ingresos del período",
                  value: cop(data.income.revenue),
                  icon: Wallet,
                  note: `${data.income.period_sales} ventas confirmadas`,
                  accent: true,
                },
                {
                  label: "Productos activos",
                  value: data.counts.products,
                  icon: Package,
                  note: `${data.counts.low_stock} con stock bajo`,
                },
                {
                  label: "Clientes activos",
                  value: data.counts.customers,
                  icon: Users,
                  note: "Relaciones que crecen",
                },
                {
                  label: "Ventas confirmadas",
                  value: data.counts.sales,
                  icon: ShoppingBag,
                  note: "Histórico de operaciones",
                },
              ].map((s, i) => (
                <section
                  className={"stat-card " + (s.accent ? "accent" : "")}
                  key={i}
                >
                  <div className="stat-label">
                    {s.label}
                    <span className="stat-icon">
                      <s.icon size={18} />
                    </span>
                  </div>
                  <strong className={i === 0 ? "currency-value" : ""}>
                    {s.value}
                  </strong>
                  <p>
                    {i === 1 && <span className="status-dot amber" />}
                    {s.note}
                  </p>
                </section>
              ))}
            </div>
            <div className="dashboard-middle">
              <section className="surface chart-card">
                <div className="section-heading">
                  <div>
                    <h2>Comportamiento de ventas</h2>
                    <p>Ingresos por día · COP</p>
                  </div>
                  <span className="chart-key">
                    <span /> Ventas
                  </span>
                </div>
                {data.chart.length ? (
                  <div className="sales-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.chart.map((r: any) => ({
                          ...r,
                          total: Number(r.total),
                        }))}
                        margin={{ left: 0, right: 16, top: 20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="salesGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#128b78"
                              stopOpacity={0.18}
                            />
                            <stop
                              offset="100%"
                              stopColor="#128b78"
                              stopOpacity={0.01}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="4 5"
                          vertical={false}
                          stroke="#e6eceb"
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => String(v).slice(5)}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#88959d", fontSize: 11 }}
                          dy={10}
                        />
                        <YAxis
                          tickFormatter={(v) =>
                            Number(v) >= 1000000
                              ? `${Number(v) / 1000000}M`
                              : `${Number(v) / 1000}k`
                          }
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#88959d", fontSize: 11 }}
                          width={54}
                        />
                        <Tooltip
                          formatter={(v) => [cop(v), "Ventas"]}
                          labelFormatter={(v) => "Fecha: " + v}
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #e5ecea",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="total"
                          stroke="#128b78"
                          strokeWidth={2.5}
                          fill="url(#salesGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty text="No hay ventas confirmadas en este período." />
                )}
                <div className="chart-footer">
                  <span>
                    Del {data.period.from} al {data.period.to}
                  </span>
                  <span>Información del período seleccionado</span>
                </div>
              </section>
              <section className="surface top-card">
                <div className="section-heading">
                  <div>
                    <h2>Los más vendidos</h2>
                    <p>Productos que impulsan tu negocio</p>
                  </div>
                  <ArrowUpRight size={18} />
                </div>
                {data.top.length ? (
                  <div className="top-products">
                    {data.top.map((p: any, i: number) => (
                      <div className="top-product" key={p.product_id}>
                        <span className="rank">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="top-product-info">
                          <strong>{p.product_name}</strong>
                          <small>{p.quantity} unidades vendidas</small>
                          <div className="mini-bar">
                            <span
                              style={{
                                width: `${(Number(p.quantity) / Number(data.top[0].quantity)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <span className="top-revenue">{cop(p.total)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty />
                )}
                <div className="tiny-stat-row">
                  <div>
                    <strong>{data.counts.suppliers}</strong>
                    <span>Proveedores activos</span>
                  </div>
                  <div>
                    <strong>{data.counts.purchases}</strong>
                    <span>Compras recibidas</span>
                  </div>
                </div>
              </section>
            </div>
            <div className="dashboard-bottom">
              <section className="surface">
                <div className="section-heading">
                  <div>
                    <h2>Ventas recientes</h2>
                    <p>Las últimas operaciones registradas</p>
                  </div>
                  {can("sales.read") && (
                    <Link className="text-link" to="/sales">
                      Ver todas <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
                {data.recent.length ? (
                  <div className="table-responsive">
                    <table className="table align-middle dashboard-table">
                      <thead>
                        <tr>
                          <th>Venta</th>
                          <th>Cliente</th>
                          <th>Fecha</th>
                          <th>Total</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent.map((r: any) => (
                          <tr key={r.id}>
                            <td className="sale-ref">
                              #{String(r.id).padStart(5, "0")}
                            </td>
                            <td>{r.customer}</td>
                            <td className="text-secondary">
                              {date(r.created_at).split(",")[0]}
                            </td>
                            <td className="money">{cop(r.total)}</td>
                            <td>
                              <Badge value={r.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty />
                )}
              </section>
              <section className="surface low-card">
                <div className="section-heading">
                  <div>
                    <h2>
                      <AlertTriangle size={17} /> Atención al inventario
                    </h2>
                    <p>Productos que necesitan reposición</p>
                  </div>
                  <span className="count-pill">{data.counts.low_stock}</span>
                </div>
                {data.low.length ? (
                  data.low.map((r: any) => (
                    <div className="low-item" key={r.id}>
                      <div>
                        <strong>{r.name}</strong>
                        <small>Mínimo: {r.min_stock} unidades</small>
                      </div>
                      <span className="stock-warning">
                        {r.stock} disponibles
                      </span>
                    </div>
                  ))
                ) : (
                  <Empty text="El inventario está por encima de los mínimos." />
                )}
                <Link to="/inventory" className="inventory-link">
                  Revisar inventario <ArrowRight size={16} />
                </Link>
              </section>
            </div>
            <div className="workspace-note">
              <span className="status-dot" /> Información conectada · Una sola
              fuente para cada decisión<span>SIGE / Espacio de trabajo</span>
            </div>
          </>
        )
      )}
    </>
  );
}
