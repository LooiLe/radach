import { createPortal } from 'react-dom'
import './ConfirmDialog.css'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel
}) {
  if (!open) return null

  return createPortal(
    <div className="confirm-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="confirm-dialog-box">
        <h3 id="confirm-dialog-title">{title}</h3>
        {message && <p>{message}</p>}
        <div className="confirm-dialog-actions">
          <button className="confirm-dialog-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={danger ? 'confirm-dialog-danger' : 'confirm-dialog-primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
