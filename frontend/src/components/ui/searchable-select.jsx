import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Badge } from "./badge";

/**
 * SearchableSelect - A searchable dropdown component
 * 
 * Props:
 * - options: Array of { value: string, label: string, color?: string }
 * - value: string (selected value) or string[] for multi-select
 * - onValueChange: (value) => void
 * - placeholder: string
 * - searchPlaceholder: string
 * - emptyText: string
 * - disabled: boolean
 * - multiple: boolean (enable multi-select)
 * - className: string
 */
export function SearchableSelect({
  options = [],
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  multiple = false,
  className,
  "data-testid": dataTestId,
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  // Get display label for current value
  const getDisplayLabel = () => {
    if (multiple) {
      const selectedValues = Array.isArray(value) ? value : [];
      if (selectedValues.length === 0) return placeholder;
      if (selectedValues.length === 1) {
        const opt = options.find(o => o.value === selectedValues[0]);
        return opt?.label || selectedValues[0];
      }
      return `${selectedValues.length} selected`;
    }
    if (!value) return placeholder;
    const opt = options.find(o => o.value === value);
    return opt?.label || value;
  };

  const handleSelect = (optionValue) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter(v => v !== optionValue)
        : [...currentValues, optionValue];
      onValueChange(newValues);
    } else {
      onValueChange(optionValue);
      setOpen(false);
    }
    setSearch("");
  };

  const isSelected = (optionValue) => {
    if (multiple) {
      return Array.isArray(value) && value.includes(optionValue);
    }
    return value === optionValue;
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
          data-testid={dataTestId}
        >
          <span className="truncate">{getDisplayLabel()}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" sideOffset={4}>
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  isSelected(option.value) && "bg-accent"
                )}
                onClick={() => handleSelect(option.value)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    isSelected(option.value) ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.color && (
                  <div
                    className="w-3 h-3 rounded-full mr-2 shrink-0"
                    style={{ backgroundColor: option.color }}
                  />
                )}
                <span className="truncate">{option.label}</span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * SearchableMultiSelect - Multi-select variant with badges
 */
export function SearchableMultiSelect({
  options = [],
  value = [],
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  className,
  maxDisplay = 3,
  "data-testid": dataTestId,
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedValues = Array.isArray(value) ? value : [];

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  const handleSelect = (optionValue) => {
    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue];
    onValueChange(newValues);
  };

  const handleRemove = (optionValue, e) => {
    e.stopPropagation();
    onValueChange(selectedValues.filter(v => v !== optionValue));
  };

  const getSelectedOptions = () => {
    return selectedValues
      .map(v => options.find(o => o.value === v))
      .filter(Boolean);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal min-h-[40px] h-auto",
            className
          )}
          data-testid={dataTestId}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedValues.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {getSelectedOptions().slice(0, maxDisplay).map((opt) => (
                  <Badge
                    key={opt.value}
                    variant="secondary"
                    className="mr-1"
                    style={opt.color ? { borderLeft: `3px solid ${opt.color}` } : {}}
                  >
                    {opt.label}
                    <button
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => handleRemove(opt.value, e)}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                {selectedValues.length > maxDisplay && (
                  <Badge variant="secondary">
                    +{selectedValues.length - maxDisplay} more
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  selectedValues.includes(option.value) && "bg-accent"
                )}
                onClick={() => handleSelect(option.value)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.color && (
                  <div
                    className="w-3 h-3 rounded-full mr-2 shrink-0"
                    style={{ backgroundColor: option.color }}
                  />
                )}
                <span className="truncate">{option.label}</span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
