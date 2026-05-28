import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useApi } from '../hooks/useApi';
import './ReportModal.css';

export default function ReportModal({ contentType, contentId, onClose, onSuccess }) {
  const { apiFetch } = useApi();
  const [reason, setReason] = useState('SPAM');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await apiFetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          contentId,
          reason,
          details
        })
      });

      if (res.ok) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit report. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="report-modal-overlay" onClick={onClose}>
      <div className="report-modal-content glass animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <button className="report-modal-close" onClick={onClose}>✕</button>
        <h2 className="report-modal-title">🚨 Report Content</h2>
        <p className="report-modal-sub">
          Help us keep the community safe. Tell us what is wrong with this {contentType?.toLowerCase()?.replace('_', ' ')}.
        </p>

        {error && <div className="msg msg-error">{error}</div>}

        <form onSubmit={handleSubmit} className="report-modal-form">
          <div className="field">
            <label className="label">Reason for reporting</label>
            <select 
              className="input select" 
              value={reason} 
              onChange={e => setReason(e.target.value)}
              disabled={submitting}
            >
              <option value="SPAM">Spam or misleading</option>
              <option value="INAPPROPRIATE">Inappropriate or offensive content</option>
              <option value="HARASSMENT">Harassment or hate speech</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="field">
            <label className="label">Details (optional)</label>
            <textarea 
              className="input textarea" 
              value={details} 
              onChange={e => setDetails(e.target.value)}
              placeholder="Provide more context (e.g. offensive language, fake location, etc.)..."
              disabled={submitting}
              rows={4}
            />
          </div>

          <div className="report-modal-actions">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-danger btn-report-submit" 
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
