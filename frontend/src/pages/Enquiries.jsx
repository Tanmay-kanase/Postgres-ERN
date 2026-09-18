import { useEffect, useState } from "react";
import api from "../api/client";
import Layout from "../components/Layout";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";

const emptyItem = { productId: "", quantity: 1 };

export default function Enquiries() {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    mobile: "",
    email: "",
    city: "",
    requiredDate: "",
    notes: "",
    items: [{ ...emptyItem }],
  });

  async function load() {
    const [eRes, pRes] = await Promise.all([api.get("/enquiries"), api.get("/products")]);
    setEnquiries(eRes.data);
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

  function removeItem(idx) {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/enquiries", {
        customer: {
          companyName: form.companyName,
          contactPerson: form.contactPerson,
          mobile: form.mobile,
          email: form.email || undefined,
          city: form.city || undefined,
        },
        requiredDate: form.requiredDate || undefined,
        notes: form.notes || undefined,
        items: form.items.map((it) => ({ productId: Number(it.productId), quantity: Number(it.quantity) })),
      });
      setShowForm(false);
      setForm({
        companyName: "", contactPerson: "", mobile: "", email: "", city: "",
        requiredDate: "", notes: "", items: [{ ...emptyItem }],
      });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create enquiry");
    }
  }

  return (
    <Layout title="Enquiries">
      {user.role === "SALES_USER" && (
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ marginBottom: 16 }}>
          {showForm ? "Cancel" : "+ New Enquiry"}
        </button>
      )}

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          {error && <div className="error-box">{error}</div>}
          <div className="form-row">
            <input placeholder="Company Name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
            <input placeholder="Contact Person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} required />
            <input placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required />
          </div>
          <div className="form-row">
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input type="date" placeholder="Required Date" value={form.requiredDate} onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} />
          </div>
          <div className="form-row">
            <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="line-items">
            <strong>Products</strong>
            {form.items.map((item, idx) => (
              <div className="form-row" key={idx}>
                <select value={item.productId} onChange={(e) => updateItem(idx, "productId", e.target.value)} required>
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
                <input type="number" min="1" placeholder="Quantity" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} required />
                {form.items.length > 1 && (
                  <button type="button" className="btn-danger" onClick={() => removeItem(idx)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={addItem}>
              + Add product
            </button>
          </div>

          <button className="btn-success" type="submit">
            Save Enquiry
          </button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Enquiry #</th>
            <th>Customer</th>
            <th>Products</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {enquiries.map((enq) => (
            <tr key={enq.id}>
              <td>{enq.enquiryNumber}</td>
              <td>{enq.customer?.companyName}</td>
              <td>
                {enq.items.map((it) => `${it.product.name} (${it.quantity})`).join(", ")}
              </td>
              <td>{new Date(enq.enquiryDate).toLocaleDateString()}</td>
              <td>
                <Badge status={enq.status} />
              </td>
            </tr>
          ))}
          {enquiries.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">No enquiries yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Layout>
  );
}
