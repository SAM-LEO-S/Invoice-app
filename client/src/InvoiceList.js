import React, { useState } from 'react';
import axios from 'axios';

export default function InvoiceList() {
  const [studentName, setStudentName] = useState('');
  const [invoices, setInvoices] = useState([]);

  const search = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get('http://localhost:4000/invoices', {
      params: { studentName },
      headers: { Authorization: `Bearer ${token}` }
    });
    setInvoices(res.data);
  };

  return (
    <div className="form">
      <h2>Search Invoices</h2>
      <input placeholder="Student Name" value={studentName} onChange={e => setStudentName(e.target.value)} />
      <button onClick={search}>Search</button>
      <ul>
        {invoices.map(inv => (
          <li key={inv.filename}>
            {inv.studentName} ({inv.date}) - 
            <a href={`http://localhost:4000/download/${inv.filename}`} target="_blank" rel="noopener noreferrer">Download</a>
          </li>
        ))}
      </ul>
    </div>
  );
} 