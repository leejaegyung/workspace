# Design System Document: The Kinetic Workspace



## 1. Overview & Creative North Star

**The Creative North Star: "Atmospheric Precision"**



This design system rejects the "boxy" constraints of traditional SaaS dashboards. Instead of a rigid grid of outlined containers, we treat the UI as a fluid, high-end editorial environment. By leveraging deep tonal depth and vibrant electric accents, we create a workspace that feels like a high-performance studio rather than a spreadsheet.



The system breaks the "template" look through **Tonal Layering**. We move away from 1px borders and high-contrast separators, favoring intentional asymmetry and "breathing" layouts. Elements should feel like they are floating in a dark, atmospheric space, unified by soft light and glass-like properties.



---



## 2. Colors & Surface Philosophy

Our palette is rooted in a deep charcoal foundation, punctuated by high-energy electric blues and violets.



### Surface Hierarchy & The "No-Line" Rule

**Core Directive:** Explicitly prohibit 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts.

- **Base Layer:** Use `surface` (#0e0e0e) for the primary application background.

- **Nesting:** Place `surface_container_low` (#131313) for sidebars and `surface_container` (#1a1a1a) for main content areas.

- **Elevation:** Use `surface_container_high` (#20201f) or `surface_container_highest` (#262626) for active states or floating cards. This creates a "nested" depth that feels architectural rather than flat.



### The Glass & Gradient Rule

To move beyond a "standard" dark mode, use Glassmorphism for floating overlays (Modals, Popovers, Tooltips):

- **Glass Effect:** Apply `surface_container_highest` at 70% opacity with a `20px` backdrop-blur.

- **Signature Gradients:** For primary CTAs and progress indicators, blend `primary` (#97a9ff) into `secondary` (#ac8aff) at a 135-degree angle. This injects "soul" into the professional environment.



---



## 3. Typography

We employ a dual-font strategy to balance editorial authority with functional clarity.



- **Display & Headlines (Manrope):** Use Manrope for all `display` and `headline` tokens. Its geometric yet warm curves provide a high-end, custom feel.

- *Usage:* Keep tracking tight (-0.02em) for `display-lg` to create a bold, impactful statement.

- **Functional UI (Inter):** Use Inter for `title`, `body`, and `label` tokens. Inter is optimized for readability in dense workspace environments.

- **Hierarchy via Scale:** Emphasize the gap between `headline-lg` (2rem) and `body-md` (0.875rem). Use the large display type to anchor pages, allowing the "workspace" elements to sit quietly beneath.



---



## 4. Elevation & Depth

In this system, depth is a product of light and layering, not structural lines.



- **The Layering Principle:** Achieve lift by stacking. A `surface_container_lowest` (#000000) card sitting on a `surface_container_low` (#131313) section creates a natural, recessed "well" effect.

- **Ambient Shadows:** Shadows must be felt, not seen. Use `on_surface` (#ffffff) at 4% opacity with a `40px` blur and `20px` Y-offset for floating elements. This mimics natural ambient light in a dark room.

- **The "Ghost Border" Fallback:** If a divider is functionally required for accessibility, use the `outline_variant` (#484847) token at **15% opacity**. It should be a suggestion of a line, not a hard barrier.

- **Interactivity:** On hover, transition a container from `surface_container` to `surface_bright` (#2c2c2c) to provide an immediate, tactile response.



---



## 5. Components



### Buttons

- **Primary:** Gradient fill (`primary` to `secondary`). Use `on_primary_fixed` (#000000) for text to ensure maximum punch.

- **Secondary:** `surface_container_highest` background with `primary` text. No border.

- **Tertiary:** Ghost style. `primary` text with no background. Background appears as `surface_variant` only on hover.

- **Radius:** Always use `md` (0.75rem) for a soft, professional touch.



### Input Fields

- **Base State:** Use `surface_container_highest` (#262626) with a `3.5` (1.2rem) vertical padding.

- **Focus State:** Transition the background to `surface_container_low` and apply a subtle `primary` (20% opacity) outer glow (not a solid stroke).



### Cards & Lists

- **Forbidden:** Never use horizontal divider lines (`

`).



- **Separation:** Use the `8` (2.75rem) spacing token to separate list items or subtle background shifts between even/odd rows.

- **Contextual Accents:** Use a 2px vertical "intent bar" of `secondary` (#ac8aff) on the left side of a card to denote an active or "unread" state.



### Selection Chips

- **Style:** Pill-shaped (`full` roundedness).

- **Active:** `secondary_container` background with `on_secondary_container` text.

- **Inactive:** `surface_container_high` background.



---



## 6. Do's and Don'ts



### Do

- **Do** use generous whitespace (Token `12` or `16`) between major functional blocks to prevent "dashboard fatigue."

- **Do** use `primary_dim` for icons to ensure they remain vibrant but don't vibrate against the dark background.

- **Do** use `tertiary` (#ffa3e9) sparingly for "delight" moments, like a completed task or a new notification.



### Don't

- **Don't** use pure white (#ffffff) for large blocks of body text; use `on_surface_variant` (#adaaaa) to reduce eye strain.

- **Don't** use 1px borders to separate the sidebar from the main content; use a transition from `surface_container_low` to `surface`.

- **Don't** use standard "drop shadows." If it doesn't look like light passing through glass, it’s too heavy.