'use client';

import { useState } from 'react';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';

/**
 * Drop-in replacement for a native `<Select name defaultValue>` inside a
 * plain `<form>` (GET filter bars, Server Action forms) — renders a hidden
 * input so the chosen value still submits under `name` on next
 * navigation/submit, with the `SearchableSelect` combobox UI on top.
 * Uncontrolled from the form's perspective, same as the `<select>` it
 * replaces: seeds from `defaultValue`, then manages its own state.
 */
export function FormSearchableSelect({
  id,
  name,
  defaultValue = '',
  options,
  placeholder,
  searchPlaceholder,
  allLabel,
  className,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  allLabel?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <SearchableSelect
        id={id}
        options={options}
        value={value}
        onChange={setValue}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        allLabel={allLabel}
        className={className}
      />
    </>
  );
}
