import { useEffect, useState } from "react";
import api from "../api/client";
import Layout from "../components/Layout";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";

const emptyItem = { productId: "", quantity: 1, unitPrice: "", discountPct: 0, gstPct: 18 };

export default function Quotations() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState({ enquiryId: "", validUntil: "", items: [{ ...emptyItem }] });

  async function load() {
    const [qRes, eRes, pRes] = await Promise.all([
      api.get("/quotations"),
      api.get("/enquiries"),
      api.get("/products"),
    ]);
    setQuotations(qRes.data);
    setEnquiries(eRes.data.filter((e) => e.status !== "WON" && e.status !== "LOST"));
    setProducts(pRes.data);
  }

  useEffect(() => {
    load();
  }, []);

  function updateItem(idx, field, value) {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  }

  function addItem() {
    setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  }

  function previewTotal() {
    return form.items.reduce((sum, it) => {
      const base = Number(it.quantity || 0) * Number(it.unitPrice || 0);
      const afterDiscount = base - (base * Number(it.discountPct || 0)) / 100;
      const afterGst = afterDiscount + (afterDiscount * Number(it.gstPct || 0)) / 100;
      return sum + afterGst;
    }, 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/quotations", {
        enquiryId: Number(form.enquiryId),
        validUntil: form.validUntil || undefined,
        items: form.items.map((it) => ({
          productId: Number(it.productId),
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discountPct: Number(it.discountPct || 0),
          gstPct: Number(it.gstPct || 0),
        })),
      });
      setShowForm(false);
      setForm({ enquiryId: "", validUntil: "", items: [{ ...emptyItem }] });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create quotation");
    }
  }

  async function updateStatus(id, status) {
    setActionError("");
    try {
      await api.patch(`/quotations/${id}/status`, { status });
      load();
    } catch (err) {
      setActionError(err.response?.data?.error || "Action failed");
    }
  }

  async function convert(id) {
    setActionError("");
    try {
      await api.post(`/quotations/${id}/convert`);
      load();
      alert("Sales Order created.");
    } catch (err) {
      setActionError(err.response?.data?.error || "Conversion failed");
    }
  }

  return (
    <Layout title="Quotations">
      {user.role === "SALES_USER" && (
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ marginBottom: 16 }}>
          {showForm ? "Cancel" : "+ New Quotation"}
        </button>
      )}
      {actionError && <div className="error-box">{actionError}</div>}

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          {error && <div className="error-box">{error}</div>}
          <div className="form-row">
            <select value={form.enquiryId} onChange={(e) => setForm({ ...form, enquiryId: e.target.value })} required>
              <option value="">Select enquiry</option>
              {enquiries.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.enquiryNumber} — {e.customer?.companyName}
                </option>
              ))}
            </select>
            <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
          </div>

          <div className="line-items">
            <strong>Products</strong>
            {form.items.map((item, idx) => (
              <div className="form-row" key={idx}>
                <select value={item.productId} onChange={(e) => updateItem(idx, "productId", e.target.value)} required>
                  <option value="">Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} (avail: {p.availableQuantity})
                    </option>
                  ))}
                </select>
                <input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} required />
                <input type="number" min="0" step="0.01" placeholder="Unit Price" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} required />
                <input type="number" min="0" max="100" placeholder="Discount %" value={item.discountPct} onChange={(e) => updateItem(idx, "discountPct", e.target.value)} />
                <input type="number" min="0" max="100" placeholder="GST %" value={item.gstPct} onChange={(e) => updateItem(idx, "gstPct", e.target.value)} />
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={addItem}>
              + Add product
            </button>
            <p className="muted">
              Preview total (server recalculates and is authoritative): ₹{previewTotal().toFixed(2)}
            </p>
          </div>

          <button className="btn-success" type="submit">
            Save Quotation (Draft)
          </button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Quotation #</th>
            <th>Customer</th>
            <th>Grand Total</th>
            <th>Status</th>
            <th>Sales Order</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {quotations.map((q) => (
            <tr key={q.id}>
              <td>{q.quotationNumber}</td>
              <td>{q.customer?.companyName}</td>
              <td>₹{Number(q.grandTotal).toFixed(2)}</td>
              <td><Badge status={q.status} /></td>
              <td>{q.salesOrder ? q.salesOrder.orderNumber : "—"}</td>
              <td>
                {user.role === "SALES_USER" && q.status === "DRAFT" && (
                  <button className="btn-secondary" onClick={() => updateStatus(q.id, "SENT")}>Mark Sent</button>
                )}
                {user.role === "SALES_USER" && q.status === "SENT" && (
                  <>
                    <button className="btn-success" onClick={() => updateStatus(q.id, "ACCEPTED")}>Accept</button>{" "}
                    <button className="btn-danger" onClick={() => updateStatus(q.id, "REJECTED")}>Reject</button>
                  </>
                )}
                {user.role === "SALES_USER" && q.status === "ACCEPTED" && !q.salesOrder && (
                  <button className="btn-primary" onClick={() => convert(q.id)}>Convert to Sales Order</button>
                )}
              </td>
            </tr>
          ))}
          {quotations.length === 0 && (
            <tr><td colSpan={6} className="muted">No quotations yet.</td></tr>
          )}
        </tbody>
      </table>
    </Layout>
  );
}
