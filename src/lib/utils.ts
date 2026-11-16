import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const moneyFormatters = new Map<string, Intl.NumberFormat>()

/** Format a Shopify Money value (amount is a decimal string). */
export function formatMoney(amount: string | number, currencyCode: string, locale?: string) {
  const key = `${locale ?? ""}|${currencyCode}`
  let fmt = moneyFormatters.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode })
    moneyFormatters.set(key, fmt)
  }
  const value = typeof amount === "number" ? amount : Number.parseFloat(amount)
  return fmt.format(Number.isFinite(value) ? value : 0)
}
