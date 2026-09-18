# PERN ERP Case Study

Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch

Stack: **PostgreSQL + Express.js + React.js (Vite) + Node.js**, Prisma ORM.

## 1. Tech Stack

- **Backend**: Node.js, Express.js, Prisma ORM, PostgreSQL, JWT auth, bcryptjs, Jest + Supertest
- **Frontend**: React 18 (Vite), React Router, Axios, plain CSS
- **Database**: PostgreSQL with relational schema (see ER diagram below)

## 2. Project Structure

```
pern-case-study/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # data model
│   │   ├── seed.js              # users + 6 seeded products
│   │   └── extra_constraints.sql# DB-level CHECK constraints
│   ├── src/
│   │   ├── app.js               # express app (routes wired)
│   │   ├── server.js            # bootstrap
│   │   ├── config/db.js         # prisma client
│   │   ├── middleware/          # auth.js (JWT), roles.js (RBAC)
│   │   ├── routes/               
│   │   ├── controllers/         # business logic
│   │   └── utils/               # calc.js (totals), genNumber.js
│   └── tests/                   # 5 mandatory tests + bonus concurrency test
├── frontend/
│   └── src/
│       ├── pages/                # Login, Enquiries, Quotations, SalesOrders
│       ├── components/           # Layout, Badge, ProtectedRoute
│       ├── auth/AuthContext.jsx
│       └── api/client.js
└── postman_collection.json
```

## 3. Database Setup

1. Install PostgreSQL locally (or use a container) and create a database:
   ```bash
   createdb pern_erp
   ```
2. Copy env file and edit credentials:
   ```bash
   cd backend
   cp .env.example .env
   # edit DATABASE_URL, JWT_SECRET
   ```
3. Install dependencies, generate Prisma client, run migrations:
   ```bash
   npm install
   npx prisma migrate dev --name init
   ```
4. Apply the extra DB-level CHECK constraints (non-negative stock, etc.):
   ```bash
   psql "$DATABASE_URL" -f prisma/extra_constraints.sql
   ```
5. Seed the database (creates the Admin/Sales users and 6 industrial products):
   ```bash
   npm run prisma:seed
   ```

## 4. Environment Variables

**backend/.env**
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pern_erp?schema=public"
JWT_SECRET="change_this_to_a_long_random_secret"
JWT_EXPIRES_IN="8h"
PORT=4000
```

**frontend/.env**
```
VITE_API_BASE_URL=http://localhost:4000
```

## 5. How to Run

**Backend**
```bash
cd backend
npm install
npm run dev        # http://localhost:4000
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev         # http://localhost:5173
```

## 6. Test Login Credentials

| Role  | Email            | Password  |
|-------|------------------|-----------|
| Admin | admin@erp.com    | Admin@123 |
| Sales | sales@erp.com    | Sales@123 |

## 7. How to Run Tests

Tests run against the same PostgreSQL database configured in `backend/.env` (make sure
migrations + seed have run first, since tests rely on the seeded Admin/Sales users and
at least one seeded product).

```bash
cd backend
npm test
```

Implements the 5 mandatory tests plus a bonus concurrency test:

1. `tests/calc.test.js` — **Test 1**: quotation total is calculated correctly (discount then GST).
2. `tests/quotation-to-order.test.js` — **Test 2**: DRAFT/REJECTED quotation cannot create a Sales Order.
3. `tests/duplicate-order.test.js` — **Test 3**: same quotation cannot generate duplicate Sales Orders (including a simultaneous double-convert race).
4. `tests/inventory-reservation.test.js` — **Test 4**: cannot reserve more than available inventory.
5. `tests/rbac.test.js` — **Test 5**: unauthorized user cannot perform a restricted operation.
6. `tests/concurrency.test.js` — **Bonus**: two simultaneous reservations against the same limited stock — only one succeeds.

## 8. Database Schema / ER Diagram

```
users (id, name, email, password_hash, role)
customers (id, company_name, contact_person, mobile, email, city)
products (id, code, name, category, unit, base_price)
inventory (id, product_id -> products, physical_quantity, reserved_quantity)
enquiries (id, enquiry_number, customer_id -> customers, created_by_id -> users,
           enquiry_date, required_date, notes, status)
enquiry_items (id, enquiry_id -> enquiries, product_id -> products, quantity)
quotations (id, quotation_number, enquiry_id -> enquiries, customer_id -> customers,
            created_by_id -> users, valid_until, grand_total, status)
quotation_items (id, quotation_id -> quotations, product_id -> products, quantity,
                  unit_price, discount_pct, gst_pct, line_amount)
sales_orders (id, order_number, quotation_id -> quotations [UNIQUE], customer_id -> customers,
              order_date, total_amount, status)
sales_order_items (id, sales_order_id -> sales_orders, product_id -> products, quantity,
                    dispatched_quantity)
dispatches (id, dispatch_number, sales_order_id -> sales_orders, dispatch_date,
            vehicle_number, driver_name)
dispatch_items (id, dispatch_id -> dispatches, product_id -> products, quantity)
```

Relationships:
- `customers 1—N enquiries 1—N quotations 1—1 sales_orders 1—N dispatches`
- `quotations.quotation_id` on `sales_orders` is **UNIQUE**, which is the primary guard
  (enforced at the DB level) against one quotation producing more than one Sales Order.
- `inventory.product_id` is **UNIQUE** (one inventory row per product).

Available Quantity is **never stored** — it's always derived as
`physical_quantity - reserved_quantity`, so it can never drift out of sync.

## 9. API Documentation

Import `postman_collection.json` (repo root) into Postman — it covers every endpoint
below with example bodies and uses collection variables (`{{salesToken}}`,
`{{adminToken}}`, etc.) so you can chain requests.

| Method | Endpoint                              | Role         | Description |
|--------|----------------------------------------|--------------|--------------|
| POST   | `/auth/login`                          | Public       | Returns JWT + user |
| GET    | `/auth/me`                             | Any          | Current user |
| GET    | `/products`                            | Any          | List products with computed availability |
| PATCH  | `/products/:id/stock`                  | Admin        | Adjust physical stock (`{ delta }`) |
| GET    | `/enquiries`                           | Any          | List enquiries |
| GET    | `/enquiries/:id`                       | Any          | Enquiry detail |
| POST   | `/enquiries`                           | Sales        | Create enquiry + customer + line items |
| GET    | `/quotations`                          | Any          | List quotations |
| GET    | `/quotations/:id`                      | Any          | Quotation detail |
| POST   | `/quotations`                          | Sales        | Create quotation (server computes totals) |
| PATCH  | `/quotations/:id/status`               | Sales        | `DRAFT→SENT→ACCEPTED/REJECTED` |
| POST   | `/quotations/:id/convert`              | Sales        | ACCEPTED quotation → Sales Order |
| GET    | `/sales-orders`                        | Any          | List sales orders |
| GET    | `/sales-orders/:id`                    | Any          | Sales order detail |
| POST   | `/sales-orders/:id/confirm`            | Admin        | Reserve inventory atomically |
| POST   | `/sales-orders/:id/cancel`             | Admin        | Cancel + release reserved inventory |
| POST   | `/sales-orders/:id/dispatch`           | Admin        | Dispatch stock (physical & reserved decrease) |

## 10. Design Notes / Key Decisions

### Backend-validated totals
`POST /quotations` and the preview shown on the frontend both compute
`Base Amount = Qty × Unit Price`, apply discount, then GST. The frontend's number is
only a preview — the **backend always recomputes** `lineAmount` and `grandTotal` from
raw `quantity/unitPrice/discountPct/gstPct` and ignores any total sent by the client
(see `backend/src/utils/calc.js`, used inside `quotation.controller.js`).

### Concurrency-safe inventory reservation
The core challenge (`available = 100`, two near-simultaneous reservations of 80 and 50,
only one may succeed) is solved with a **single conditional UPDATE per line item**,
executed inside a Postgres transaction:

```sql
UPDATE inventory
SET reserved_quantity = reserved_quantity + :qty
WHERE product_id = :productId
  AND (physical_quantity - reserved_quantity) >= :qty
```

This is atomic at the row level — Postgres takes a row lock for the duration of the
UPDATE, so a second concurrent transaction targeting the same `product_id` physically
waits for the first to commit before its `WHERE` clause is evaluated against the
now-updated row. There is no read-then-write gap for another transaction to interleave
into (unlike a naive `SELECT` to check availability followed by a separate `UPDATE`).
If the affected row count is `0`, we know — at that exact instant — that availability
was insufficient, and the whole order-confirmation transaction is rolled back.

The same pattern is reused for dispatch (`physical -= qty AND reserved -= qty`, guarded
by `reserved_quantity >= qty AND physical_quantity >= qty`) and for the per-line
`dispatched_quantity` tracking that prevents duplicate/over dispatch.

### Preventing duplicate Sales Orders from one Quotation
`sales_orders.quotation_id` has a **UNIQUE** constraint at the schema level. The
controller also checks `quotation.status === 'ACCEPTED'` and that no `salesOrder`
already exists before creating one, inside a transaction — so even two simultaneous
`convert` calls result in exactly one successful `201` and one `409 Conflict` (the
second insert hits the unique constraint, caught as Prisma error `P2002`).

### RBAC
Role is embedded in the JWT payload at login and checked in `middleware/roles.js` on
every protected route. Frontend role checks only affect which buttons render — every
mutating action is re-checked on the server, per the assignment's explicit requirement
that frontend-only restrictions are not sufficient.

## 11. AI Usage Disclosure

Parts of this submission (boilerplate scaffolding, CRUD wiring, and CSS) were built
with AI assistance. The core business logic — inventory reservation concurrency
handling, the quotation→order state machine, RBAC enforcement, and the schema design —
was reviewed and is understood well enough to explain, modify, or debug live, as the
assignment requires.

## 12. Live Verification Round — how the two example changes would be made

**Add `damaged_quantity` to inventory:**
1. Prisma schema: add `damagedQuantity Int @default(0) @map("damaged_quantity")` to `Inventory`.
2. Migration: `npx prisma migrate dev --name add_damaged_quantity`.
3. Backend: update `computed availability` in `product.controller.js` to
   `available = physical - reserved - damaged`; add an admin endpoint/field to record
   damaged stock (mirrors `adjustPhysicalStock`, but increments `damagedQuantity` and
   decrements `physicalQuantity` in one transaction).
4. Frontend: add a "Damaged" column next to Physical/Reserved/Available in the
   Sales Orders inventory table.

**Allow cancelling a CONFIRMED order and releasing reserved stock:**
Already implemented — see `POST /sales-orders/:id/cancel` in
`salesOrder.controller.js`, which releases `quantity - dispatchedQuantity` back to
`reserved_quantity` for each line when cancelling a `CONFIRMED` order, and the
**Cancel** button on the Sales Orders screen.
