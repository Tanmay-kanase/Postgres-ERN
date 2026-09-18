import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Enquiries from "./pages/Enquiries";
import Quotations from "./pages/Quotations";
import SalesOrders from "./pages/SalesOrders";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/enquiries"
        element={
          <ProtectedRoute>
            <Enquiries />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotations"
        element={
          <ProtectedRoute>
            <Quotations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales-orders"
        element={
          <ProtectedRoute>
            <SalesOrders />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/enquiries" replace />} />
    </Routes>
  );
}
