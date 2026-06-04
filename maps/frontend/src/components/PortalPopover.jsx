import { forwardRef } from 'react'
import { createPortal } from 'react-dom'

const PortalPopover = forwardRef(function PortalPopover({ children, style, onClick }, ref) {
  return createPortal(
    <div ref={ref} className="spot-card-friend-likes-popover" style={style} onClick={onClick}>
      {children}
    </div>,
    document.body
  )
})

export default PortalPopover