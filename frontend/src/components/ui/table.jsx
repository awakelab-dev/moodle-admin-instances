import * as React from "react"

import { cn } from "@/lib/utils"

// Sin wrapper con su propio overflow: se delega el scroll (si hace falta)
// al contenedor externo que ya envuelve cada uso de <Table> en la app
// (.table-wrapper / .cs-report-box). Tener dos contenedores con scroll
// anidados —este y el externo— hacía que la barra horizontal quedase
// pegada al final de TODO el contenido en vez de al final de la zona
// visible, así que solo aparecía al llegar al final del scroll vertical.
const Table = React.forwardRef(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn("w-full caption-bottom text-sm", className)}
    {...props} />
))
Table.displayName = "Table"

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border-soft", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props} />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t border-border-soft bg-surface-muted/50 font-medium", className)}
    {...props} />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border-soft transition-colors hover:bg-surface-muted/50",
      className
    )}
    {...props} />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle text-xs font-bold uppercase tracking-[0.06em] text-brand-strong",
      className
    )}
    {...props} />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("px-4 py-3 align-middle text-sm", className)} {...props} />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-3 text-sm text-muted-foreground", className)}
    {...props} />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
