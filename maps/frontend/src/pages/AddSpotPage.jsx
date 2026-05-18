import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import './AddSpotPage.css';

export default function AddSpotPage() {
  const { apiFetch } = useApi();
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState([]);
  
  const [name, setName] = useState('');
  const [type, setType] = useState('Other');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [tags, setTags] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(isAdmin ? 'ACTIVE' : 'PENDING'); // Auto-approve for admins
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  const [suggestions, setSuggestions] = useState([]);
  const geocodeTimer = useRef(null);
  const newlyUploaded = useRef([]);

  useEffect(() => {
    return () => {
      // Cleanup newly uploaded photos if component unmounts before saving
      if (newlyUploaded.current.length > 0) {
        newlyUploaded.current.forEach(url => {
          fetch(`/api/v1/upload?url=${encodeURIComponent(url)}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }).catch(() => {});
        });
      }
    };
  }, []);

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

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    setUploading(true);
    setMsg({ type: '', text: '' });
    try {
      const newPhotoUrls = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          setMsg({ type: 'error', text: `File ${file.name} exceeds 5MB limit.` });
          continue;
        }
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await apiFetch('/api/v1/upload', {
          method: 'POST',
          body: formData
        });
        
        if (res.ok) {
          const data = await res.json();
          newPhotoUrls.push(data.url);
          newlyUploaded.current.push(data.url);
        } else {
          setMsg({ type: 'error', text: `Failed to upload ${file.name}` });
        }
      }
      setPhotos(prev => [...prev, ...newPhotoUrls]);
    } catch (err) {
      setMsg({ type: 'error', text: 'Error uploading files' });
    } finally {
      setUploading(false);
      // reset file input
      e.target.value = '';
    }
  };

  const removePhoto = async (index) => {
    const photoUrl = photos[index];
    try {
      await apiFetch(`/api/v1/upload?url=${encodeURIComponent(photoUrl)}`, {
        method: 'DELETE'
      });
      newlyUploaded.current = newlyUploaded.current.filter(url => url !== photoUrl);
    } catch (err) {
      console.error('Failed to delete photo from server', err);
    }
    setPhotos(prev => prev.filter((_, i) => i !== index));
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
          photos: photos,
          websiteUrl: websiteUrl.trim(),
          status
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: `✓ "${data.name}" submitted successfully!` });
        newlyUploaded.current = [];
        setName(''); setAddress(''); setLat(''); setLng(''); setTags(''); setPhotos([]); setWebsiteUrl('');
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

        <div className="form-row">
          <div className="field">
            <label className="label">Tags (comma separated)</label>
            <input className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. thai, trending, cheap" />
          </div>
          <div className="field">
            <label className="label">Website / Social Link</label>
            <input className="input" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://instagram.com/..." />
          </div>
        </div>

        <div className="field">
          <label className="label">Photos (Max 5MB per image)</label>
          <input type="file" multiple accept="image/png, image/jpeg, image/webp" className="input" onChange={handleFileChange} disabled={uploading} />
          {uploading && <div style={{ fontSize: '0.9rem', color: 'var(--primary)', marginTop: '0.5rem' }}>Uploading images...</div>}
          
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              {photos.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: '80px', height: '80px' }}>
                  <img src={'http://localhost:8080' + url} alt="Upload preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                  <button 
                    onClick={() => removePhoto(idx)}
                    style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-primary btn-submit" onClick={addSpot}>
          ➕ Submit Spot
        </button>
      </div>
    </div>
  );
}
