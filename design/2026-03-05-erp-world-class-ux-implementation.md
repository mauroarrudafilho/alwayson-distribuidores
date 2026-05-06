# ERP World Class UX/UI Revamp (V2) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a high-density, keyboard-friendly UI for the Orders module without affecting the existing V1 routes.

**Architecture:** Create parallel `/admin/v2/*` routes. Build new high-density components (`DataTableV2`, `FormLayoutV2`, `AppLayoutV2`) using existing data fetching hooks.

**Tech Stack:** React, Vite, Tailwind CSS, Shadcn UI, TanStack Table, React Hook Form, Lucide Icons.

---

### Task 1: Create V2 App Layout and Routing

**Files:**
- Create: `src/components/admin/v2/AppLayoutV2.tsx`
- Create: `src/components/admin/v2/CommandPalette.tsx`
- Modify: `src/App.tsx`

**Step 1: Create CommandPalette component**
Create a basic Command Palette using Shadcn `Command` component that opens with `Cmd+K`.

**Step 2: Create AppLayoutV2 component**
Create a layout with a collapsible sidebar and a compact header that includes the CommandPalette.

**Step 3: Update App.tsx routing**
Add a new route group under `/admin/v2` that uses `AppLayoutV2`. Add dummy routes for `/admin/v2/orders` and `/admin/v2/orders/:id`.

**Step 4: Commit**
```bash
git add src/components/admin/v2/ src/App.tsx
git commit -m "feat(v2): add AppLayoutV2 and CommandPalette with basic routing"
```

---

### Task 2: Create DataTableV2 Component

**Files:**
- Create: `src/components/ui/v2/data-table-v2.tsx`
- Create: `src/components/ui/v2/data-table-v2.css` (if needed for sticky columns)

**Step 1: Implement base DataTableV2**
Create a wrapper around TanStack Table configured for high density (small padding, text-sm).

**Step 2: Add Sticky Headers and Columns**
Implement CSS/Tailwind classes to make the header row and the first column sticky during scroll.

**Step 3: Add Inline Filters**
Add input fields directly below the column headers for quick filtering.

**Step 4: Commit**
```bash
git add src/components/ui/v2/
git commit -m "feat(v2): create high-density DataTableV2 component"
```

---

### Task 3: Implement V2 Orders List

**Files:**
- Create: `src/pages/admin/v2/orders/OrdersListV2.tsx`
- Create: `src/pages/admin/v2/orders/columns.tsx`

**Step 1: Define V2 Columns**
Create column definitions for the orders table, including custom cell renderers for status badges and hover actions (Edit, PDF).

**Step 2: Implement OrdersListV2**
Fetch data using `getAllOrdersFromSupabase` (or existing hook) and pass it to `DataTableV2`.

**Step 3: Update App.tsx**
Point the `/admin/v2/orders` route to `OrdersListV2`.

**Step 4: Commit**
```bash
git add src/pages/admin/v2/orders/ src/App.tsx
git commit -m "feat(v2): implement OrdersListV2 using DataTableV2"
```

---

### Task 4: Create FormLayoutV2 and Keyboard Shortcuts

**Files:**
- Create: `src/components/ui/v2/form-layout-v2.tsx`
- Create: `src/hooks/use-keyboard-shortcuts.ts`

**Step 1: Implement useKeyboardShortcuts hook**
Create a hook to listen for `Ctrl+S`/`Cmd+S` (save) and `Esc` (cancel).

**Step 2: Implement FormLayoutV2**
Create a layout with a sticky sidebar for section navigation (Tabs) and a main content area for the form fields. Include dirty state detection.

**Step 3: Commit**
```bash
git add src/components/ui/v2/ src/hooks/use-keyboard-shortcuts.ts
git commit -m "feat(v2): create FormLayoutV2 and keyboard shortcuts hook"
```

---

### Task 5: Implement V2 Order Detail/Edit

**Files:**
- Create: `src/pages/admin/v2/orders/OrderDetailV2.tsx`
- Create: `src/pages/admin/v2/orders/sections/OrderGeneralInfo.tsx`
- Create: `src/pages/admin/v2/orders/sections/OrderItemsInline.tsx`

**Step 1: Create Order Sections**
Break down the order form into smaller components (General Info, Items). Implement inline editing for the items table.

**Step 2: Implement OrderDetailV2**
Fetch order data, wrap the sections in `FormLayoutV2`, and wire up the save logic (using existing `saveAdjustedOrderVersion`).

**Step 3: Update App.tsx**
Point the `/admin/v2/orders/:id` route to `OrderDetailV2`.

**Step 4: Commit**
```bash
git add src/pages/admin/v2/orders/ src/App.tsx
git commit -m "feat(v2): implement OrderDetailV2 with FormLayoutV2 and inline editing"
```