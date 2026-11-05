import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { pool, transaction, one, rows } from "./config/db.js";
import { env } from "./config/env.js";
import { create, transition } from "./services/orders.js";
import { adjust } from "./services/inventory.js";
import type { Actor } from "./auth/service.js";
if (env.NODE_ENV === "production")
  throw new Error("El seed académico está deshabilitado en producción.");
const modules = [
  "users",
  "products",
  "categories",
  "customers",
  "suppliers",
  "inventory",
  "sales",
  "purchases",
];
const permissions = [
  ...modules.flatMap((v) => [`${v}.read`, `${v}.write`]),
  "dashboard.read",
  "reports.read",
  "audit.read",
];
const password = process.env.SEED_ADMIN_PASSWORD || "SigeDemo!2026";
if (password.length < 12)
  throw new Error("SEED_ADMIN_PASSWORD requiere 12 caracteres.");
try {
  await transaction(async (db) => {
    for (const [i, name] of [
      "administrador",
      "vendedor",
      "inventario",
    ].entries())
      await db.query("INSERT IGNORE INTO roles(id,name) VALUES(?,?)", [
        i + 1,
        name,
      ]);
    for (const p of permissions)
      await db.query("INSERT IGNORE INTO permisos(name) VALUES(?)", [p]);
    const all = await rows(db, "SELECT * FROM permisos");
    for (const role of [1, 2, 3]) {
      const allowed =
        role === 1
          ? permissions
          : role === 2
            ? [
                "dashboard.read",
                "products.read",
                "categories.read",
                "customers.read",
                "customers.write",
                "sales.read",
                "sales.write",
                "inventory.read",
              ]
            : [
                "dashboard.read",
                "products.read",
                "products.write",
                "categories.read",
                "categories.write",
                "suppliers.read",
                "suppliers.write",
                "purchases.read",
                "purchases.write",
                "inventory.read",
                "inventory.write",
              ];
      for (const p of all.filter((p) => allowed.includes(p.name)))
        await db.query(
          "INSERT IGNORE INTO roles_permisos(role_id,permission_id) VALUES(?,?)",
          [role, p.id],
        );
    }
    const encoded = await argon2.hash(password, { type: argon2.argon2id });
    for (const [i, n] of [
      "Administración",
      "María Ventas",
      "Carlos Inventario",
    ].entries())
      await db.query(
        "INSERT IGNORE INTO usuarios(name,email,password_hash,role_id) VALUES(?,?,?,?)",
        [
          n,
          ["admin", "ventas", "inventario"][i] + "@sige.local",
          encoded,
          i + 1,
        ],
      );
  });
  const admin = await one(
    pool,
    "SELECT u.*,r.name role FROM usuarios u JOIN roles r ON r.id=u.role_id WHERE email='admin@sige.local'",
  );
  const actor = {
    ...admin,
    permissions,
    sessionId: "seed",
    csrfHash: "",
  } as Actor;
  const marker = await one(
    pool,
    "SELECT id FROM productos WHERE code='TEC-001'",
  );
  if (!marker) {
    await transaction(async (db) => {
      for (const name of ["Tecnología", "Papelería", "Oficina", "Accesorios"])
        await db.query("INSERT INTO categorias(name,description) VALUES(?,?)", [
          name,
          `Productos de ${name.toLowerCase()}`,
        ]);
      for (const [i, name] of [
        "Distribuciones Andina",
        "TecnoSur SAS",
        "Suministros del Sur",
      ].entries())
        await db.query(
          "INSERT INTO proveedores(identification,name,phone,email,address) VALUES(?,?,?,?,?)",
          [
            `90010000${i}`,
            name,
            `315800000${i}`,
            `contacto${i}@example.com`,
            "Pasto, Nariño",
          ],
        );
      for (const [i, name] of [
        "Laura Martínez",
        "Comercial Galán",
        "Andrés López",
        "Diana Torres",
        "Oficinas del Sur",
      ].entries())
        await db.query(
          "INSERT INTO clientes(identification,name,phone,email,address) VALUES(?,?,?,?,?)",
          [
            `10850000${i}`,
            name,
            `312700000${i}`,
            `cliente${i}@example.com`,
            "Iles, Nariño",
          ],
        );
      const cats = await rows(db, "SELECT id FROM categorias ORDER BY id"),
        sup = await rows(db, "SELECT id FROM proveedores ORDER BY id");
      const products = [
        ["TEC-001", "Teclado inalámbrico", 0, "45000.00", "79000.00", 8],
        ["TEC-002", "Mouse ergonómico", 0, "28000.00", "49000.00", 10],
        ["TEC-003", "Monitor 24 pulgadas", 0, "420000.00", "649000.00", 3],
        ["PAP-001", "Cuaderno universitario", 1, "6500.00", "12000.00", 15],
        ["PAP-002", "Resma de papel carta", 1, "14500.00", "23000.00", 10],
        ["OFI-001", "Silla de oficina", 2, "180000.00", "289000.00", 4],
        ["ACC-001", "Hub USB de 4 puertos", 3, "22000.00", "39000.00", 8],
        ["ACC-002", "Base para portátil", 3, "36000.00", "59000.00", 5],
      ];
      for (const [code, name, costCat, cost, price, min] of products) {
        const [r] = await db.query(
          "INSERT INTO productos(code,name,description,category_id,supplier_id,purchase_price,sale_price,min_stock) VALUES(?,?,?,?,?,?,?,?)",
          [
            code,
            name,
            `Demostración académica: ${name}`,
            cats[Number(costCat)].id,
            sup[0].id,
            cost,
            price,
            min,
          ],
        );
        await db.query(
          "INSERT INTO inventarios(product_id,stock) VALUES(?,0)",
          [r.insertId],
        );
      }
    });
    const products = await rows(pool, "SELECT id FROM productos ORDER BY id");
    for (const [i, p] of products.entries())
      await adjust(actor, {
        product_id: p.id,
        quantity: [48, 60, 12, 100, 50, 14, 30, 24][i] || 20,
        reason: "Saldo inicial de demostración",
      });
    const customers = await rows(pool, "SELECT id FROM clientes ORDER BY id");
    for (let i = 0; i < 12; i++) {
      const sale = await create(actor, "sales", {
        party_id: customers[i % customers.length].id,
        request_key: randomUUID(),
        items: [
          {
            product_id: products[i % products.length].id,
            quantity: (i % 3) + 1,
          },
        ],
      });
      await transition(actor, "sales", sale.id, "confirm");
      await pool.query(
        "UPDATE ventas SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL ? DAY) WHERE id=?",
        [i * 2, sale.id],
      );
    }
    const supplier = await one(
      pool,
      "SELECT id FROM proveedores ORDER BY id LIMIT 1",
    );
    const purchase = await create(actor, "purchases", {
      party_id: supplier!.id,
      request_key: randomUUID(),
      items: [
        { product_id: products[0].id, quantity: 10, unit_price: "45000.00" },
      ],
    });
    await transition(actor, "purchases", purchase.id, "receive");
    await adjust(actor, {
      product_id: products[6].id,
      quantity: -25,
      reason: "Ajuste de demostración para alerta de stock",
    });
    console.log("Datos de demostración creados.");
  } else
    console.log(
      "Ya existen datos de demostración; no se modificaron existencias ni contraseñas.",
    );
  console.log(
    "Usuarios locales: admin@sige.local, ventas@sige.local, inventario@sige.local. Contraseña: la configurada en SEED_ADMIN_PASSWORD o la indicada en README.",
  );
} finally {
  await pool.end();
}
