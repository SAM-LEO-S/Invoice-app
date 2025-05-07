import React, { useState } from 'react';
import axios from 'axios';

const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10];

function numberToWords(num) {
  // Simple number to words for up to 99999 (for demo)
  const a = [ '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen' ];
  const b = [ '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety' ];
  if ((num = num.toString()).length > 9) return 'overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + ' crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + ' lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + ' thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + ' hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + ' ' : '';
  return str.trim() + ' only';
}

export default function InvoiceForm() {
  const [form, setForm] = useState({
    studentName: '', number: '', term: '', className: '', date: '',
    paymentMethod: 'Cash', drawn: '', branch: '',
    fees: [{ label: '', amount: '' }],
    totalAmount: '', amountInWords: '',
    denominations: DENOMINATIONS.map(denom => ({ denomination: denom, count: '', amount: '' }))
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    let value = e.target.value;
    if (e.target.name === 'totalAmount') {
      // Convert to words automatically
      setForm(f => ({ ...f, totalAmount: value, amountInWords: value ? numberToWords(Number(value)) : '' }));
      return;
    }
    setForm({ ...form, [e.target.name]: value });
  };

  const handleFeeChange = (i, e) => {
    const fees = [...form.fees];
    fees[i][e.target.name] = e.target.value;
    setForm({ ...form, fees });
  };

  const addFee = () => setForm({ ...form, fees: [...form.fees, { label: '', amount: '' }] });

  const handleDenomChange = (i, e) => {
    const denominations = [...form.denominations];
    const count = e.target.value;
    denominations[i].count = count;
    denominations[i].amount = count ? (Number(count) * denominations[i].denomination).toString() : '';
    setForm({ ...form, denominations });
  };

  // Validation function
  function validateForm() {
    // Sum of all fee amounts
    const sumOfFees = form.fees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
    // Sum of all denominations
    const sumOfDenominations = form.denominations.reduce(
      (sum, d) => sum + (Number(d.denomination) * Number(d.count || 0)),
      0
    );
    // Check if totalAmount matches both
    const totalAmountNum = Number(form.totalAmount || 0);
    if (sumOfFees !== totalAmountNum) {
      setMessage("Total amount should be the sum of all fee items!");
      return false;
    }
    if (sumOfDenominations !== totalAmountNum) {
      setMessage("Sum of denominations should match the total amount!");
      return false;
    }
    return true;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(""); // Clear previous messages
    if (!validateForm()) {
      return; // Stop submission if validation fails
    }
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('https://invoice-app-08lz.onrender.com/generate-invoice', form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Invoice generated!');
      window.open(`https://invoice-app-08lz.onrender.com/download/${res.data.filename}`);
    } catch (err) {
      setMessage('Error generating invoice');
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h2>Generate Invoice</h2>
      <input name="studentName" placeholder="Student Name" value={form.studentName} onChange={handleChange} required />
      <input name="number" placeholder="Number" value={form.number} onChange={handleChange} required />
      <input name="term" placeholder="Term" value={form.term} onChange={handleChange} required />
      <input name="className" placeholder="Class" value={form.className} onChange={handleChange} required />
      <input name="date" type="date" value={form.date} onChange={handleChange} required />
      <label>Payment Method
        <select name="paymentMethod" value={form.paymentMethod} onChange={handleChange} required>
          <option value="Cash">Cash</option>
          <option value="Cheque">Cheque</option>
          <option value="DD">DD</option>
        </select>
      </label>
      <input name="drawn" placeholder="Drawn" value={form.drawn} onChange={handleChange} />
      <input name="branch" placeholder="Branch" value={form.branch} onChange={handleChange} />

      <h4>Fees Breakdown</h4>
      {form.fees.map((fee, i) => (
        <div key={i}>
          <input name="label" placeholder="Label" value={fee.label} onChange={e => handleFeeChange(i, e)} required />
          <input name="amount" placeholder="Amount" value={fee.amount} onChange={e => handleFeeChange(i, e)} required />
        </div>
      ))}
      <button type="button" onClick={addFee}>Add Fee</button>

      <input name="totalAmount" placeholder="Total Amount" value={form.totalAmount} onChange={handleChange} required />
      <input name="amountInWords" placeholder="Amount in Words" value={form.amountInWords} readOnly required />

      <h4>Denominations</h4>
      {form.denominations.map((d, i) => (
        <div key={d.denomination} style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
          <label>{d.denomination} x</label>
          <input
            name="count"
            type="number"
            min="0"
            placeholder="Count"
            value={d.count}
            onChange={e => handleDenomChange(i, e)}
            style={{ width: '60px' }}
          />
          <input
            name="amount"
            placeholder="Amount"
            value={d.amount}
            readOnly
            style={{ width: '90px' }}
          />
        </div>
      ))}

      <button type="submit">Generate</button>
      {message && <div>{message}</div>}
    </form>
  );
} 
