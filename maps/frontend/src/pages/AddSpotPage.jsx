import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import './AddSpotPage.css';

export default function AddSpotPage() {
  const { apiFetch } = useApi();
  const [categories, setCategories] = useState([]);
  
  const [name, setName] = useState('');
  const [type, setType] = useState('Other');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState('PENDING'); // Default to PENDING for regular users
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  const [suggestions, setSuggestions] = useState([]);
  const geocodeTimer = useRef(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await apiFetch('/api/v1/categories');
        const data = await res.json();
        if (res.ok && data.length > 0) {
          const sorted = data.sort((a, b) => {
            if (a.name.toLowerCase() === 'other') return 1;
            if (b.name.toLowerCase() === 'other') return -1;
            return a.name.localeCompare(b.name);
          });
          setCategories(sorted);
          setType(sorted[0].name);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }
    fetchCategories();
  }, [apiFetch]);

  const handleAddressInput = (q) => {
    setAddress(q);
    clearTimeout(geocodeTimer.current);
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    geocodeTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`, { headers: { 'Accept-Language': 'en' } });
        setSuggestions(await res.json());
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const selectAddress = (s) => {
    setAddress(s.display_name);
    setLat(s.lat);
    setLng(s.lon);
    setSuggestions([]);
  };

  const addSpot = async () => {
    if (!name || !address || !lat || !lng) {
      setMsg({ type: 'error', text: 'Fill in name, address, latitude, and longitude.' });
      return;
    }
    setMsg({ type: '', text: '' });
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    try {
      const res = await apiFetch('/api/v1/spots', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          type,
          address: address.trim(),
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          tags: tagList,
          status
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: `✓ "${data.name}" submitted successfully!` });
        setName(''); setAddress(''); setLat(''); setLng(''); setTags('');
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to submit spot.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Server error. Please try again later.' });
    }
  };

  return (
    <div className="add-spot-page animate-fade-up">
      <div className="add-spot-container glass">
        <h1 className="page-title" style={{ marginTop: 0 }}>Add a new spot</h1>
        <p className="page-sub">Contribute to the map! New spots may require admin approval.</p>

        {msg.text && <div className={`msg msg-${msg.type}`} style={{ marginBottom: '1.5rem' }}>{msg.text}</div>}

        <div className="form-row">
          <div className="field">
            <label className="label">Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Spot name" />
          </div>
          <div className="field">
            <label className="label">Type</label>
            <select className="input select" value={type} onChange={e => setType(e.target.value)}>
              {categories.length > 0 ? (
                categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
              ) : (
                ['Restaurant', 'Food Hall', 'Café', 'Bar', 'Market', 'Other'].map(t => <option key={t} value={t}>{t}</option>)
              )}
            </select>
          </div>
        </div>

        <div className="field" style={{ position: 'relative' }}>
          <label className="label">Address</label>
          <input className="input" value={address} onChange={e => handleAddressInput(e.target.value)} placeholder="Full address" autoComplete="off" />
          {suggestions.length > 0 && (
            <div className="suggestions-dropdown" style={{ top: '100%' }}>
              {suggestions.map((s, i) => (
                <div key={i} className="suggestion-item" onClick={() => selectAddress(s)}>
                  <div className="suggestion-name">{s.display_name.split(',')[0]}</div>
                  <div className="suggestion-full">{s.display_name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="field">
            <label className="label">Latitude</label>
            <input className="input" value={lat} readOnly style={{ opacity: 0.6 }} placeholder="Auto-filled from address" />
          </div>
          <div className="field">
            <label className="label">Longitude</label>
            <input className="input" value={lng} readOnly style={{ opacity: 0.6 }} placeholder="Auto-filled from address" />
          </div>
        </div>

        <div className="field">
          <label className="label">Tags (comma separated)</label>
          <input className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. thai, trending, cheap" />
        </div>

        <button className="btn btn-primary btn-submit" onClick={addSpot}>
          ➕ Submit Spot
        </button>
      </div>
    </div>
  );
}
