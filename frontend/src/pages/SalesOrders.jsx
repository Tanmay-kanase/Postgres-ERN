import { useEffect, useState } from "react";
import api from "../api/client";
import Layout from "../components/Layout";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";

export default function SalesOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [actionError, setActionError] = useState("");
  const [dispatchFor, setDispatchFor] = useState(null); // order object
  const [dispatchForm, setDispatchForm] = useState({ vehicleNumber: "", driverName: "", quantities: {} });

  async function load() {
    const [oRes, pRes] = await Promise.all([api.get("/sales-orders"), api.get("/products")]);
    setOrders(oRes.data);
    setProducts(pRes.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function confirm(id) {
    setActionError("");
    try {
      await api.post(`/sales-orders/${id}/confirm`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.error || "Confirm failed");
    }
  }

  async function cancel(id) {
    setActionError("");
    try {
      await api.post(`/sales-orders/${id}/cancel`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.error || "Cancel failed");
    }
  }

  function openDispatch(order) {
    const quantities = {};
    order.items.forEach((it) => {
      quantities[it.productId] = it.quantity - it.dispatchedQuantity;
    });
    setDispatchForm({ vehicleNumber: "", driverName: "", quantities });
    setDispatchFor(order);
  }

  async function submitDispatch(e) {
    e.preventDefault();
    setActionError("");
    try {
      const items = Object.entries(dispatchForm.quantities)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([productId, quantity]) => ({ productId: Number(productId), quantity: Number(quantity) }));

      await api.post(`/sales-orders/${dispatchFor.id}/dispatch`, {
        vehicleNumber: dispatchForm.vehicleNumber,
        driverName: dispatchForm.driverName,
        items,
      });
      setDispatchFor(null);
      load();
    } catch (err) {
      setActionError(err.response?.data?.error || "Dispatch failed");
    }
  }

  return (
    <Layout title="Sales Orders">
      {actionError && <div className="error-box">{actionError}</div>}

      <div className="card">
        <strong>Inventory Availability</strong>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr><th>Code</th><th>Product</th><th>Physical</th><th>Reserved</th><th>Available</th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td>{p.physicalQuantity}</td>
                <td>{p.reservedQuantity}</td>
                <td>{p.availableQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <table>
        <thead>
          <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Products</th>
            <th>Total</th>
            <th>Status</th>
            {user.role === "ADMIN" && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.orderNumber}</td>
              <td>{o.customer?.companyName}</td>
              <td>{o.items.map((it) => `${it.product.name} (${it.quantity})`).join(", ")}</td>
              <td>₹{Number(o.totalAmount).toFixed(2)}</td>
              <td><Badge status={o.status} /></td>
              {user.role === "ADMIN" && (
                <td>
                  {o.status === "PENDING" && (
                    <>
                      <button className="btn-success" onClick={() => confirm(o.id)}>Confirm</button>{" "}
                      <button className="btn-danger" onClick={() => cancel(o.id)}>Cancel</button>
                    </>
                  )}
                  {o.status === "CONFIRMED" && (
                    <>
                      <button className="btn-primary" onClick={() => openDispatch(o)}>Dispatch</button>{" "}
                      <button className="btn-danger" onClick={() => cancel(o.id)}>Cancel</button>
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td colSpan={6} className="muted">No sales orders yet.</td></tr>
          )}
        </tbody>
      </table>

      {dispatchFor && (
        <div className="card" style={{ marginTop: 20 }}>
          <strong>Dispatch — {dispatchFor.orderNumber}</strong>
          <form onSubmit={submitDispatch}>
            <div className="form-row">
              <input
                placeholder="Vehicle Number"
                value={dispatchForm.vehicleNumber}
                onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNumber: e.target.value })}
                required
              />
              <input
                placeholder="Driver Name"
                value={dispatchForm.driverName}
                onChange={(e) => setDispatchForm({ ...dispatchForm, driverName: e.target.value })}
                required
              />
            </div>
            {dispatchFor.items.map((it) => (
              <div className="form-row" key={it.productId}>
                <span style={{ flex: 1 }}>{it.product.name} (ordered {it.quantity}, remaining {it.quantity - it.dispatchedQuantity})</span>
                <input
                  type="number"
                  min="0"
                  max={it.quantity - it.dispatchedQuantity}
                  value={dispatchForm.quantities[it.productId] ?? 0}
                  onChange={(e) =>
                    setDispatchForm({
                      ...dispatchForm,
                      quantities: { ...dispatchForm.quantities, [it.productId]: e.target.value },
                    })
                  }
                />
              </div>
            ))}
            <button className="btn-success" type="submit">Confirm Dispatch</button>{" "}
            <button type="button" className="btn-secondary" onClick={() => setDispatchFor(null)}>Cancel</button>
          </form>
        </div>
      )}
    </Layout>
  );
}
