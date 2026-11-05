import { pool, rows, one } from "../config/db.js";
import { paging } from "../validators/index.js";
export async function dashboard(query: unknown) {
  const p = paging.parse(query);
  const from =
      p.from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
    to = p.to || new Date().toISOString().slice(0, 10);
  const range = [from, to];
  const [counts, income, chart, top, low, recent] = await Promise.all([
    one(
      pool,
      "SELECT (SELECT COUNT(*) FROM productos WHERE status='active') products,(SELECT COUNT(*) FROM clientes WHERE status='active') customers,(SELECT COUNT(*) FROM proveedores WHERE status='active') suppliers,(SELECT COUNT(*) FROM ventas WHERE status='confirmed') sales,(SELECT COUNT(*) FROM compras WHERE status='received') purchases,(SELECT COUNT(*) FROM inventarios i JOIN productos p ON p.id=i.product_id WHERE i.stock<=p.min_stock AND p.status='active') low_stock",
    ),
    one(
      pool,
      "SELECT COALESCE(SUM(total),0) revenue,COUNT(*) period_sales FROM ventas WHERE status='confirmed' AND created_at>=? AND created_at<DATE_ADD(?,INTERVAL 1 DAY)",
      range,
    ),
    rows(
      pool,
      "SELECT DATE_FORMAT(created_at,'%Y-%m-%d') date,CAST(SUM(total) AS CHAR) total FROM ventas WHERE status='confirmed' AND created_at>=? AND created_at<DATE_ADD(?,INTERVAL 1 DAY) GROUP BY DATE_FORMAT(created_at,'%Y-%m-%d') ORDER BY date",
      range,
    ),
    rows(
      pool,
      "SELECT i.product_id,i.product_name,SUM(i.quantity) quantity,CAST(SUM(i.subtotal) AS CHAR) total FROM detalles_venta i JOIN ventas s ON s.id=i.sale_id WHERE s.status='confirmed' AND s.created_at>=? AND s.created_at<DATE_ADD(?,INTERVAL 1 DAY) GROUP BY i.product_id,i.product_name ORDER BY quantity DESC LIMIT 5",
      range,
    ),
    rows(
      pool,
      "SELECT p.id,p.name,p.code,p.min_stock,i.stock FROM productos p JOIN inventarios i ON i.product_id=p.id WHERE p.status='active' AND i.stock<=p.min_stock ORDER BY i.stock,p.id LIMIT 8",
    ),
    rows(
      pool,
      "SELECT s.id,c.name AS customer,s.total,s.status,s.created_at FROM ventas s JOIN clientes c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 6",
    ),
  ]);
  return { counts, income, chart, top, low, recent, period: { from, to } };
}
export async function notifications(userId: number, query: unknown) {
  const p = paging.parse(query);
  const total = await one(pool, "SELECT COUNT(*) n FROM notificaciones");
  const unread = await one(
    pool,
    "SELECT COUNT(*) n FROM notificaciones n LEFT JOIN lecturas_notificaciones r ON r.notification_id=n.id AND r.user_id=? WHERE r.user_id IS NULL",
    [userId],
  );
  return {
    data: await rows(
      pool,
      "SELECT n.*,r.read_at FROM notificaciones n LEFT JOIN lecturas_notificaciones r ON r.notification_id=n.id AND r.user_id=? ORDER BY n.id DESC LIMIT ? OFFSET ?",
      [userId, p.pageSize, (p.page - 1) * p.pageSize],
    ),
    meta: {
      total: Number(total?.n),
      unread: Number(unread?.n),
      page: p.page,
      pageSize: p.pageSize,
    },
  };
}
export async function auditLog(query: unknown) {
  const p = paging.parse(query);
  let where = "WHERE a.action LIKE ?";
  const params: any[] = [`%${p.q}%`];
  if (p.from) {
    where += " AND a.created_at>=?";
    params.push(p.from);
  }
  if (p.to) {
    where += " AND a.created_at<DATE_ADD(?,INTERVAL 1 DAY)";
    params.push(p.to);
  }
  const total = await one(
    pool,
    `SELECT COUNT(*) n FROM registros_auditoria a ${where}`,
    params,
  );
  return {
    data: await rows(
      pool,
      `SELECT a.*,u.name AS user_name FROM registros_auditoria a LEFT JOIN usuarios u ON u.id=a.user_id ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
      [...params, p.pageSize, (p.page - 1) * p.pageSize],
    ),
    meta: { total: Number(total?.n), page: p.page, pageSize: p.pageSize },
  };
}
