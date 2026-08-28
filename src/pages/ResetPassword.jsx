import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../config/supabaseclient';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirmation) return setError('Passwords do not match.');

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) return setError(updateError.message);
    setMessage('Your password has been updated. You can now log in.');
    setTimeout(() => navigate('/mother-login'), 1200);
  };

  return (
    <main style={{ maxWidth: 460, margin: '8rem auto', padding: 32 }}>
      <h1>Set a new password</h1>
      <p>Choose a new password for your DASMOM account.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required style={{ display: 'block', width: '100%', margin: '8px 0 16px', padding: 10 }} />
        <label htmlFor="confirm-password">Confirm password</label>
        <input id="confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required style={{ display: 'block', width: '100%', margin: '8px 0 16px', padding: 10 }} />
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button type="submit" disabled={saving}>{saving ? 'Updating...' : 'Update password'}</button>
      </form>
    </main>
  );
}
