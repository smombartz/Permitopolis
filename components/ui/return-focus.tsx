"use client"

import * as React from "react"
import { MAIN_CONTENT_ID } from "@/components/ui/skip-link"

/**
 * Where focus goes when a dialog or a sheet closes.
 *
 * Radix hands focus back to the dialog's trigger. Almost no dialog here has one: a card's sheet
 * and a case's action panel open from the URL (`?card=`, `?task=`), and the palette, the
 * shortcuts list and every confirmation open from state. With no trigger Radix focused nothing,
 * and closing with Esc left a keyboard at the top of the page (WCAG 2.4.3).
 *
 * `Dialog` and `Sheet` use this instead: remember what had focus when the content mounted, and
 * go back to it on close. If that element is gone (the action it started removed it, the page
 * changed) focus goes to the page's content, never to nowhere. A dialog opened from a menu item
 * goes back to the button that opened the menu, since the item is gone by then.
 */
export function useReturnFocus(onCloseAutoFocus?: (event: Event) => void) {
  const opener = React.useRef<HTMLElement | null>(null)

  const handleCloseAutoFocus = React.useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event)
      if (event.defaultPrevented) return
      const remembered = opener.current
      opener.current = null
      const target = remembered && remembered.isConnected && remembered !== document.body ? remembered : document.getElementById(MAIN_CONTENT_ID)
      if (!target) return
      event.preventDefault()
      target.focus()
    },
    [onCloseAutoFocus]
  )

  return { opener, onCloseAutoFocus: handleCloseAutoFocus }
}

/**
 * The first child of a dialog's content. It mounts when the dialog opens, and its layout effect
 * runs before Radix moves focus inside (a passive effect) and before any `autoFocus` field
 * after it, so what has focus at that moment is still whatever opened the dialog.
 */
export function OpenerProbe({ openerRef }: { openerRef: React.RefObject<HTMLElement | null> }) {
  React.useLayoutEffect(() => {
    const active = document.activeElement as HTMLElement | null
    const menu = active?.closest('[role="menu"]')
    const menuButton = menu ? document.getElementById(menu.getAttribute("aria-labelledby") ?? "") : null
    openerRef.current = menuButton ?? active
  }, [openerRef])
  return null
}
