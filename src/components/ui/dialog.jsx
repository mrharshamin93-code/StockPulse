"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef(({
  className,
  children,
  style,
  ...props
}, ref) => {
  const contentRef = React.useRef(null)
  const [visualViewport, setVisualViewport] = React.useState(null)
  const [searchScrollThumb, setSearchScrollThumb] = React.useState(null)

  const setContentRef = React.useCallback(
    (node) => {
      contentRef.current = node

      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [ref]
  )

  React.useEffect(() => {
    const viewport = window.visualViewport

    const updateVisualViewport = () => {
      if (!viewport || window.innerWidth >= 640) {
        setVisualViewport(null)
        return
      }

      const height = Math.round(viewport.height)
      const offsetTop = Math.round(viewport.offsetTop || 0)
      const keyboardOpen = height < window.innerHeight - 120

      setVisualViewport({
        height,
        offsetTop,
        keyboardOpen,
      })
    }

    updateVisualViewport()

    window.addEventListener("resize", updateVisualViewport)
    viewport?.addEventListener("resize", updateVisualViewport)
    viewport?.addEventListener("scroll", updateVisualViewport)

    return () => {
      window.removeEventListener("resize", updateVisualViewport)
      viewport?.removeEventListener("resize", updateVisualViewport)
      viewport?.removeEventListener("scroll", updateVisualViewport)
    }
  }, [])

  React.useEffect(() => {
    const content = contentRef.current

    if (!content) {
      return undefined
    }

    const searchInput = content.querySelector(
      'input[placeholder="Search ticker or company"]'
    )

    if (!searchInput) {
      setSearchScrollThumb(null)
      return undefined
    }

    const scroller = content.querySelector(".overflow-y-auto")

    if (!scroller) {
      setSearchScrollThumb(null)
      return undefined
    }

    let animationFrame = null

    const updateThumb = () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame)
      }

      animationFrame = requestAnimationFrame(() => {
        animationFrame = null

        const contentRect = content.getBoundingClientRect()
        const scrollerRectBeforeSizing = scroller.getBoundingClientRect()
        const availableHeight = Math.max(
          132,
          contentRect.bottom - scrollerRectBeforeSizing.top - 14
        )
        const targetHeight = Math.min(264, availableHeight)

        scroller.style.maxHeight = `${targetHeight}px`
        scroller.style.overflowY = "auto"
        scroller.style.WebkitOverflowScrolling = "touch"
        scroller.style.flexShrink = "1"

        const clientHeight = scroller.clientHeight
        const scrollHeight = scroller.scrollHeight
        const maxScrollTop = Math.max(0, scrollHeight - clientHeight)

        if (clientHeight <= 0 || maxScrollTop <= 1) {
          setSearchScrollThumb(null)
          return
        }

        const scrollerRect = scroller.getBoundingClientRect()
        const inset = 6
        const trackHeight = Math.max(0, clientHeight - inset * 2)
        const thumbHeight = Math.max(
          38,
          Math.min(
            trackHeight,
            trackHeight * (clientHeight / scrollHeight)
          )
        )
        const thumbTravel = Math.max(0, trackHeight - thumbHeight)
        const progress = Math.min(
          1,
          Math.max(0, scroller.scrollTop / maxScrollTop)
        )

        setSearchScrollThumb({
          top:
            scrollerRect.top -
            contentRect.top +
            inset +
            thumbTravel * progress,
          right: Math.max(7, contentRect.right - scrollerRect.right + 7),
          height: thumbHeight,
        })
      })
    }

    updateThumb()

    scroller.addEventListener("scroll", updateThumb, { passive: true })
    window.addEventListener("resize", updateThumb)
    window.visualViewport?.addEventListener("resize", updateThumb)
    window.visualViewport?.addEventListener("scroll", updateThumb)

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateThumb)
        : null

    resizeObserver?.observe(scroller)
    resizeObserver?.observe(content)

    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(updateThumb)
        : null

    mutationObserver?.observe(scroller, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame)
      }

      scroller.removeEventListener("scroll", updateThumb)
      window.removeEventListener("resize", updateThumb)
      window.visualViewport?.removeEventListener("resize", updateThumb)
      window.visualViewport?.removeEventListener("scroll", updateThumb)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()

      scroller.style.maxHeight = ""
      scroller.style.overflowY = ""
      scroller.style.WebkitOverflowScrolling = ""
      scroller.style.flexShrink = ""
    }
  }, [children, visualViewport])

  const keyboardStyle =
    visualViewport?.keyboardOpen
      ? {
          top: `${visualViewport.offsetTop + 10}px`,
          transform: "none",
          maxHeight: `${Math.max(180, visualViewport.height - 20)}px`,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }
      : {
          maxHeight: "calc(100dvh - 24px)",
        }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={setContentRef}
        className={cn(
          "fixed z-50 grid border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-lg top-1/2 left-4 right-4 -translate-y-1/2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-lg gap-4",
          className
        )}
        style={{
          ...keyboardStyle,
          ...style,
        }}
        {...props}
      >
        {children}

        {searchScrollThumb && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-[90] w-[7px] rounded-full bg-foreground/70 shadow-[0_0_0_1px_hsl(var(--background)/0.7)]"
            style={{
              top: `${searchScrollThumb.top}px`,
              right: `${searchScrollThumb.right}px`,
              height: `${searchScrollThumb.height}px`,
            }}
          />
        )}

        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
