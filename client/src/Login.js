import React, { useState } from 'react';
import axios from 'axios';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:4000/login', { username, password });
      localStorage.setItem('token', res.data.token);
      window.location = '/generate';
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div>
      <form className="form" onSubmit={handleLogin}>
        <h2>Login</h2>
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit">Login</button>
      </form>
      <div style={{ marginTop: '1em' }}>
        Don't have an account? <a href="/register">Register</a>
      </div>
    </div>
  );
} 