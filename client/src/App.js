import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './Login';
import Register from './Register';
import InvoiceForm from './InvoiceForm';
import InvoiceList from './InvoiceList';

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <div className="app-container">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/generate" element={<PrivateRoute><InvoiceForm /></PrivateRoute>} />
          <Route path="/invoices" element={<PrivateRoute><InvoiceList /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/generate" />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
} 