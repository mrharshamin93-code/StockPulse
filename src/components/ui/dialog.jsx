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
  const [visualViewport, setVisualViewport] = React.useState(null)

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
        ref={ref}
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
