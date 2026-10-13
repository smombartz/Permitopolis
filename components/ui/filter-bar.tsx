import * as React from "react"
import { cn } from "cn"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { plural } from "@/lib/format"

interface FilterChipProps extends React.ComponentProps<"button"> {
  active?: boolean
  icon?: React.ReactNode
}

/** A single togglable filter pill, e.g. tier or "Involves me". */
function FilterChip({ active = false, icon, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 w-fit shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap outline-none transition-colors duration-[var(--dur-fast)] ease-frost focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
        active
          ? "border-indigo-650/30 bg-pill text-fg-pill"
          : "border-line-subtle bg-surface-2 text-fg-secondary hover:bg-surface-hover",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export interface FilterSelectOption {
  value: string
  label: string
}

interface FilterBarProps extends React.ComponentProps<"div"> {
  /** Toggle chips, rendered before the select and search field. */
  children?: React.ReactNode
  selectLabel?: string
  selectValue?: string
  selectOptions?: FilterSelectOption[]
  onSelectChange?: (value: string) => void
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  /** A keyboard hint shown trailing the search field, e.g. "/". */
  searchShortcut?: string
  resultCount?: number
  resultNoun?: string
  onClear?: () => void
}

/**
 * The filter row shared by every list view: toggle chips (as children), one select, a
 * search field with a kbd hint, a result count, and "Clear filters".
 */
function FilterBar({
  children,
  selectLabel,
  selectValue,
  selectOptions,
  onSelectChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search",
  searchShortcut,
  resultCount,
  resultNoun = "result",
  onClear,
  className,
  ...props
}: FilterBarProps) {
  return (
    <div data-slot="filter-bar" className={cn("flex flex-col gap-3", className)} {...props}>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {selectOptions && selectOptions.length > 0 ? (
          <select
            aria-label={selectLabel ?? "Filter"}
            value={selectValue}
            onChange={(event) => onSelectChange?.(event.target.value)}
            className="h-8 shrink-0 rounded-control border border-line-subtle bg-surface-strong px-2.5 text-xs text-fg outline-none focus-visible:border-focus-ring focus-visible:shadow-focus-halo"
          >
            {selectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
        {onSearchChange ? (
          <InputGroup className="h-8 w-full min-w-40 flex-1 basis-48">
            <InputGroupAddon>
              <SearchIcon className="size-3.5" aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-8 text-xs"
            />
            {searchShortcut ? (
              <InputGroupAddon align="inline-end">
                <Kbd>{searchShortcut}</Kbd>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        ) : null}
      </div>
      {resultCount !== undefined || onClear ? (
        <div className="flex items-center justify-between gap-3 text-xs text-fg-secondary">
          {resultCount !== undefined ? <span>{plural(resultCount, resultNoun)}</span> : <span />}
          {onClear ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export { FilterBar, FilterChip }
