---
name: misgastos-front
description: >-
  Closed frontend decisions for the misgastos Express + EJS + Alpine UI.
  Use when changing views, CSS, forms, selects, tables, navigation, config
  screens, month view, or any visual/UI work in this project. Also use when
  the user closes a new visual decision — append it here so later chats do
  not regress.
---

# misgastos front

Read this skill before touching UI. If the user closes a new visual decision, **append it here in the same visit** before finishing.

Stack: Express + EJS + Alpine 3 + HTMX. Tokens live in `misgastos/public/css/app.css`. Cache-bust `app.css?v=` in `layouts/main.ejs` after CSS changes.

## Selects (hard rule)

Closed: looks like a normal field/select (not a pill trigger, not a custom closed button).

Open: **never** the OS/native dropdown. Only `.reg-menu` (same chrome as **Nuevo**).

Implementation:

- Forms and filters use `src/views/partials/_app-select.ejs`
- Filters pass `model` + `compact: true` via `_month-filter-select.ejs`
- `@mousedown.prevent` so Windows/macOS list never appears
- Dispatch `change` on pick (scripts like medio de pago depend on it)
- Icon/color in Categorías are pickers (`.cat-dd`), not value-selects — keep those

Do not drop a raw `<select>` in a view. Do not invent a second dropdown style.

## Config modules

Applies to Telegram, Cuentas, historial de cuenta, Tarjetas, Divisas, Gastos fijos, Ingresos fijos, Categorías, Usuarios (admin only). Not to Mes / Gastos / Ingresos unless the user asks.

- No `page-lead` / subtitle under the H1
- **List first.** The page is the table (`cfg-layout` + `cfg-list-panel` only). Same pane height as Mes (`--month-pane-h`)
- **Forms are the right capture sheet** (`dialog.capture-sheet`), same as editar un gasto: `Nuevo` / lápiz / sliders open a drawer stuck to the right margin. Do not put the create/edit form above the table
- **Nuevo** is `.btn-nuevo`: one chip (pill) that wraps a plus with its own circular accent background + the label. Not a flat accent button. Same chip on Mes / Gastos / Ingresos / Vincular
- Open via `#form` or `?edit=` + `_capture-boot.ejs`. Edit links: `?edit=id#form`
- List title: `Listado de …`
- Form actions: floppy-disk save + eraser clear, bottom-right, icon-only
- Eraser **always** (also while editing); editing eraser is a link back to the empty form
- Table type larger than body UI chrome
- Row actions: circular tinted chips (`.dt-ico-btn`), never 2000s rectangular buttons
  - Edit: pencil + `is-edit` (blue)
  - Delete: trash + `is-del` (red)
  - Account history: clock + `is-hist` (green)
  - Fijos “Gestionar”: sliders + `is-more` (opens its own capture sheet)
  - Logs / historial de cambios: clock + `is-hist` (gastos fijos, ingresos fijos, divisas) — opens a capture sheet, never a native popup
- Divisas: each tariff save **appends** `HistorialTarifaCambio`. Never overwrite history. `TarifaCambioDefault` is only the current rate.
- Checkboxes never inherit the pill `input` styles. Use `.checkbox-row` (chip with box + label). No “flying” full-width check.
- No pagination in these lists; vertical scroll + modern scrollbar + solid sticky `th`

## Categorías form (reference)

- Lives in the right `capture-sheet`, not above the table
- No form subtitle
- Live name + icon is the title (`.cat-form-title` darker pill). Table chips stay normal
- Name field: no input border, placeholder `Inserte el nombre de la categoría`
- Icon and color sit immediately after the name, as `.cat-dd` dropdowns
- Actions on a second row, right-aligned icon buttons
- Title of the table: `Listado de categorías`

## Dashboard anual

- Page title: **Resumen anual** (not “Dashboard”)
- No `page-lead` / subtitle
- Same pane height as Mes / Config (`page-pane` + `--month-pane-h`)
- Calendar: 4 columns × 3 rows on desktop (narrower cards). 3 cols ≤1100px, 2 cols ≤720px. Month card = name badge + total on one row, Fijos | Tarjetas as two columns. No color bars. Month name is a darker pill badge (`--bg-rail`) with `fa-calendar-days`. Air inside the cell, not a tight vertical stack.

## Auth

- Do **not** drop `logo.png` as a floating bitmap (`::before` background). That file has an opaque black plate and a misspelled lockup.
- Desktop: left `--bg-rail` panel with composed lockup = `logo-mark.png` + text **misgastos**. Tagline: **Conocé en qué se te va la plata** (commercial, not “workspace”).
- Login/register card: mark only (no “misgastos” word, no H1, no subtitle). Desktop split **5 / 7** (form two columns wider than the logo). Card `max-width: 28rem`. Right column: falling money drawings (`.auth-fall`). Split is **fused**, not a hard 50/50: shared diagonal wash (`108deg` rail → canvas), no divider, columns overlap slightly, falling icons fade in from the join. Icons are scattered, not a 6+6 grid. No texture on the card. No neon. Labels have icons. Submit = **Ingresar** / **Solicitar acceso** with icon.
- Public register is a **request**: `perfil=cliente`, `habilitado=false`. Do not auto-login. Login rejects pending users.
- **Usuarios** ABM (`/usuarios`) is admin-only in the config sidenav. Clients never see that link. Current owner is `admin`; new people are `cliente` until enabled.

## Alerts (SweetAlert2)

Closed for **Usuarios**. Do not use native `confirm()` / `alert()` there.

- Library: SweetAlert2 (`cdn.jsdelivr.net/npm/sweetalert2@11`) + `/js/swal-app.js`
- Confirms: form attrs `data-swal-title`, `data-swal-text`, `data-swal-confirm`, `data-swal-icon`, optional `data-swal-danger`. Helpers: `mgConfirm()`, `mgToast()`
- Flash success/error of this ABM: hidden `#mg-swal-flash` → toast top-end. Field errors stay inline
- Skin: `.mg-swal` uses site tokens (`--bg-surface`, `--ink`, `--accent`, `--danger`, `--ok`, `--warn`). Pill buttons (accent / danger / ghost). Backdrop like the capture sheet. No neon, no default white SweetAlert card
- Cancel on the left (`reverseButtons`), confirm on the right. Cancel label **Cancelar**

## Month view (already closed)

- In-view sidenav; no rail flyout
- Rail is click-to-expand only (`--rail-w` 76px / `--rail-w-open` 232px)
- Movimientos rail target is `/gastos`
- Tables: no pager; filter-only `monthTable()`; native-looking closed filter select + `.reg-menu` open
- Cuotas: no orange/red row highlights — site blue/lilac; badge total; drop Estado; title “Pendientes de impacto”
- Plan filter `Últimas 2` = penultimate rows only (`data-plan="penultima"`)
- Config hub cards removed; Telegram lives at `/configuracion` in the sidenav

## Do not regress

- Neon / glow effects: off
- Amounts: do not paint raw red “alarm” totals
- Do not restore two-column settings layout
- Do not put config create/edit forms above the table; use `dialog.capture-sheet`
- Do not restore OS select menus
- Do not restore text “Editar / Eliminar” row buttons
- Do not apply config chrome to Mes unless asked
- Do not show Usuarios in the config sidenav to `cliente`
- Do not restore native `confirm()` / `alert()` on Usuarios; use SweetAlert2 + `.mg-swal`
