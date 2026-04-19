# Kabunga Shell Redesign

Date: 2026-04-19
Status: Approved design spec
Scope: App shell and primary product surfaces

## Summary

Kabunga should move away from its current dark glassmorphism-heavy aesthetic and toward a calmer, brighter, more credible fitness product feel. The redesign should follow a hybrid performance reset:

- Most of the app uses a light, clean, modern athletic shell.
- The home screen becomes a `today's plan and progress` command center.
- The daily health check remains in the product but is reduced to a compact supporting widget on home instead of a dominant takeover card.
- High-focus training moments, especially the active workout flow, may retain a slightly darker or higher-contrast treatment to preserve intensity and concentration.

This direction is intentionally inspired by the clarity and calmness of apps like Google Fit, but adapted for Kabunga's mix of coaching, planning, nutrition, and performance tracking.

## Product Goals

- Make Kabunga feel like a real, intentional fitness product rather than a generic AI-generated UI.
- Recenter the product around training execution and visible progress.
- Reduce visual noise caused by repeated gradients, glass panels, and equally loud card treatments.
- Keep recovery and readiness useful without letting them overpower the home experience.
- Create one coherent shell system that can scale across home, workout, nutrition, community, Iron, and profile surfaces.

## Non-Goals

- Do not change underlying Firestore models, readiness calculations, or offline queue behavior as part of this redesign.
- Do not redesign the information architecture from scratch or remove existing major routes.
- Do not remove the health check feature entirely.
- Do not convert the entire app into a pure coaching dashboard or a pure casual wellness app.

## Current Problems

The current interface has several issues that make it feel overgenerated and visually repetitive:

- The same dark glass card pattern appears across too many surfaces.
- Purple-to-cyan gradient treatments dominate too many components.
- Multiple dashboard sections compete for attention with similar visual weight.
- The daily health check occupies too much prime space relative to its actual importance in the user's flow.
- Copy labels sometimes sound decorative or generic instead of calm and useful.
- Shared shell patterns such as navigation, CTA styling, and card behavior are not disciplined enough to create a distinct product identity.

## Chosen Direction

The redesign will use the approved `Hybrid Performance Reset` approach.

- The core shell becomes light, calm, spacious, and modern.
- Training remains the central product narrative.
- Recovery becomes supportive context.
- Progress and today's plan become the top-level focus.
- Intense moments may use a slightly more performance-focused visual treatment, but that should be the exception rather than the app-wide default.

## Product Structure

### Core Home Job

The home screen should optimize for `today's plan and progress`.

That means the user should land on home and immediately understand:

- what they are training today
- how far along they are
- what the next action is
- what supporting readiness or nutrition context matters for that decision

### Health Check Placement

The daily health check is still necessary, but not as a dominant hero feature.

It should:

- remain available from home
- appear as a compact readiness widget or strip
- expose the current score or state at a glance
- allow quick edit or entry
- stop occupying the largest dashboard block by default

Longer recovery history, deeper readiness context, or more archival review can live in profile or another secondary surface.

### Product Voice

Kabunga should sound like `balanced modern training`.

The voice should be:

- calm
- direct
- credible
- useful

The voice should avoid:

- hype-heavy motivational slogans
- cute or vague labels that obscure meaning
- copy that sounds auto-generated or overly branded for simple actions

## Shared Shell Design

### Overall Feel

The shell should feel:

- light
- athletic
- clean
- structured
- confident without being aggressive

The visual reference point is closer to modern health and activity products than to futuristic dark dashboards.

### Color System

Use a light shell with restrained, purposeful accent colors:

- Background: warm light moss or off-white athletic neutral
- Card surfaces: clean white or very soft tinted surfaces
- Borders: soft field-line green-gray
- Primary action color: green
- Supporting progress color: blue
- Caution color: amber
- Risk or pain color: red

Explicit rules:

- Do not keep purple as the default primary brand action color.
- Do not rely on purple-cyan gradients as the primary visual identity.
- Do not use heavy neon-on-dark styling across the full app.

### Typography

Adopt a stronger, more intentional type system for product UI.

Recommended direction:

- Primary UI font: `Manrope` or `Plus Jakarta Sans`
- Mono or numeric accent font only where needed for timers or metrics

Typography should emphasize:

- clearer hierarchy
- fewer decorative text treatments
- stronger section titles
- cleaner labels

The current gradient text treatment should be removed from standard headings.

### Surfaces

The app should use one primary card system instead of many stylistic variants.

Card rules:

- light surface by default
- subtle border
- soft shadow
- moderate radius
- no glass blur for routine surfaces
- no tinted gradient background unless the state truly needs emphasis

This card system should replace repeated uses of `.glass`, `.glass-strong`, and similar patterns across most pages.

### Buttons And Chips

Buttons should follow clearer semantic roles:

- Primary CTA: filled green
- Secondary CTA: white or light surface with border
- Supporting status chips: compact, flat, restrained
- State indicators: use semantic colors with minimal flourish

The goal is to make actions feel legible and intentional rather than flashy.

### Bottom Navigation

The bottom navigation should become lighter and simpler.

Requirements:

- more breathing room
- calmer background treatment
- clearer active state
- less glass and less glow
- stronger label legibility

It should feel integrated into the shell, not like a floating neon overlay.

## Screen-Level Design

### Dashboard / Home

Home should follow this priority order:

1. Today's plan or workout
2. Progress snapshot
3. Compact readiness strip
4. Supporting fuel, coach, streak, or performance information

Recommended structure:

- greeting with date
- main plan card with today's workout title, progress, and primary CTA
- compact readiness strip with score and edit entry point
- small support cards for progress, calories, streak, or coach context
- supporting prompts only when relevant

The current large readiness form should no longer appear as the topmost default home experience.

### Workout

Workout setup should feel cleaner and more focused on today's plan.

Requirements:

- assigned plan or selected plan should read clearly at the top
- exercise lists should use simpler, less noisy rows
- the primary workout-start action should be obvious
- templates and history should still exist, but not compete visually with today's session

### Active Workout

Active workout is the main exception to the light-shell rule.

It may retain:

- deeper contrast
- stronger emphasis
- more training-focused intensity

But it should still inherit the improved typography, clearer CTA hierarchy, and more disciplined status styling from the new system.

### Nutrition

Nutrition should move to the same clean shell and feel more integrated with training support.

Requirements:

- lighter shell and summary cards
- simplified meal grouping
- clearer macro and calorie emphasis
- better relationship to the home screen's support cards

### Iron

Iron should keep its identity as a more performance-oriented training surface, but it must still belong to the same product family.

Requirements:

- inherit the new typography, color logic, and card discipline
- keep the stronger training feel where it helps with serious lifting workflows
- avoid falling back to the old purple-glass style
- make daily tracks, progression, and season context easier to scan

### Community

Community should feel more like a clean activity and accountability feed than a stack of admin panels.

Requirements:

- simplify repeated bordered card treatments
- improve spacing rhythm
- let feed items, groups, and challenges feel clearer and more distinct
- keep community and coach-related context visually aligned with the main product shell

### Profile

Profile should become calmer and better grouped.

Requirements:

- clear account summary area
- performance tools such as 1RM stay visible and useful
- deeper readiness history or secondary recovery surfaces can live here
- settings should feel organized rather than visually fragmented

### Login And Auth Entry

The auth entry experience should be redesigned as part of the same shell reset.

Requirements:

- remove the current heavy gradient-led hero treatment
- use the same calmer palette and typography as the main app
- keep the entry flow simple and credible rather than dramatic
- make Kabunga feel like a trusted training product from the first screen

## Copy Direction

The copy system should become clearer and less decorative.

Examples of preferred direction:

- `Today's plan`
- `Readiness`
- `Weekly progress`
- `Food today`
- `Coach notes`
- `Start workout`

Examples of labels to reduce or replace when unnecessary:

- `Fast Lane`
- `Fuel & Recovery` when a simpler label would be clearer
- overly branded or motivational filler taglines

Rule:

- Use plain, useful language first.
- Use branded personality sparingly and only where it adds value.

## Motion And Atmosphere

Motion should be quieter and more purposeful.

Requirements:

- reduce glowing pulse effects on routine surfaces
- use subtle reveal and transition motion
- keep strong motion only for genuinely high-attention moments

The product should feel polished, not animated for its own sake.

## Implementation Architecture

### Design-System Layer

Implement the redesign from the shell outward, not page by page in isolation.

Start by introducing shared tokens and primitives for:

- app background
- surface colors
- borders
- shadows
- typography
- CTA variants
- chips and badges
- navigation
- section spacing

Only after that should individual pages be ported.

### Existing Logic Preservation

Keep the following logic and behaviors intact:

- readiness scoring and calculations
- health-check data model and save flow
- offline queue behavior
- coach plan behavior
- meal logging behavior
- 1RM prompt logic

The redesign changes presentation, prioritization, and language, not the underlying product model.

### Dashboard Refactor

`src/pages/DashboardPage.tsx` should be restructured to reflect the new priority stack.

Likely changes:

- promote today's plan card to the top
- compact the readiness experience
- reduce the visual weight of supporting sections
- simplify repeated card styles
- align labels and CTA text with the new copy system

`src/components/HealthCheckForm.tsx` should remain available, but its default presentation should move behind the compact readiness strip or edit flow.

### Shared Components

Shared shell components that should be updated together:

- `src/index.css`
- `src/components/BottomNav.tsx`
- shared button treatments
- shared card treatments
- profile setting rows
- dashboard summary blocks

The redesign will feel inconsistent if page-level styling changes before shell primitives are aligned.

## Rollout Plan

### Phase 1

Shared visual system and shell:

- new tokens
- new surfaces
- new CTA styles
- new bottom nav
- new typography rules
- dashboard shell reset

### Phase 2

Primary surfaces:

- Workout
- Nutrition
- Profile
- Community
- supporting shared components

### Phase 3

Focused training surfaces and polish:

- Active workout tuning
- final copy cleanup
- state and loading polish
- cross-screen consistency pass

## States And Edge Cases

### Empty States

Empty states should feel intentional and supportive rather than sparse or decorative.

For example:

- home with no workouts should guide the user into their first useful action
- missing readiness data should show a compact prompt or strip with an add or edit action, not a large takeover

### Loading States

Loading states should use:

- lighter skeletons
- quieter placeholders
- less glow

### Offline And Save Failures

Keep the current resilient behavior, including queueing and offline-safe flows, but align banners and messages with the calmer copy and shell system.

## Testing Strategy

Verification should cover both implementation quality and user-flow continuity.

Run after each major implementation phase:

- `npx tsc --noEmit`
- `npm run build`

Manual checks:

- login flow
- dashboard with readiness present
- dashboard without readiness present
- health-check edit flow
- workout setup
- active workout
- nutrition logging
- profile and 1RM updates
- community and coaching surfaces

The main regression risk is a mixed visual state where some pages adopt the new shell while others still use the old styling. The rollout should therefore prioritize shared tokens and primitives before broad page rewrites.

## Risks

- Mixed old and new styling will make the redesign feel accidental if shared primitives are not handled first.
- A full shell shift will expose places where assumptions about dark backgrounds are baked into charts, badges, and borders.
- Community and coach surfaces are large and may need a separate cleanup pass after the main shell work lands.

## Success Criteria

The redesign is successful when:

- home clearly prioritizes today's plan and progress
- readiness feels supportive instead of dominant
- the app no longer feels purple-first, glass-heavy, or AI-generated
- shared surfaces feel coherent across routes
- active workout still feels focused and high-attention
- copy sounds more direct, credible, and product-native
