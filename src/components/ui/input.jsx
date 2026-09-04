import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({
  className,
  type,
  autoFocus,
  autoComplete,
  autoCorrect,
  autoCapitalize,
  spellCheck,
  inputMode,
  placeholder,
  ...props
}, ref) => {
  const isWatchlistStockSearch = placeholder === "Search ticker or company"

  return (
    (<input
      type={isWatchlistStockSearch ? "search" : type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-white text-gray-900 placeholder:text-gray-400 px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      placeholder={placeholder}
      autoFocus={isWatchlistStockSearch ? false : autoFocus}
      autoComplete={isWatchlistStockSearch ? "off" : autoComplete}
      autoCorrect={isWatchlistStockSearch ? "off" : autoCorrect}
      autoCapitalize={isWatchlistStockSearch ? "characters" : autoCapitalize}
      spellCheck={isWatchlistStockSearch ? false : spellCheck}
      inputMode={isWatchlistStockSearch ? "search" : inputMode}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
