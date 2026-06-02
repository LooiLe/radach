import { useEffect, useState } from 'react'
import './ConfirmDialog.css'

export default function BrowserDialogProvider({ children }) {
  const [alertMessage, setAlertMessage] = useState(null)

  useEffect(() => {
    const originalAlert = window.alert

    window.alert = (message) => {
      setAlertMessage(String(message ?? ''))
    }

    return () => {
      window.alert = originalAlert
    }
  }, [])

  return (
    <>
      {children}
      {alertMessage !== null && (
        <div className="confirm-dialog-overlay" role="alertdialog" aria-modal="true" aria-labelledby="app-alert-title">
          <div className="confirm-dialog-box">
            <h3 id="app-alert-title">Notice</h3>
            <p>{alertMessage}</p>
            <div className="confirm-dialog-actions">
              <button className="confirm-dialog-primary" onClick={() => setAlertMessage(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
