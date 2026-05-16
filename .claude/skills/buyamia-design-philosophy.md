---
name: buyamia-design-philosophy
description: Evaluates UI layouts and screens against the Buyamia design philosophy. Use when the user asks to "apply the Buyamia design philosophy", "review this screen against Buyamia principles", or "transform this dashboard into a workspace".
---
# Buyamia Design Philosophy Validator

## Overview
Your goal is to evaluate designs to ensure they transition from an "Information Radiator" (a traditional dashboard that just reports the news) to an "Action Operator" (a spatial workspace built as a cockpit to drive the business).

The core mantra: "Stop designing pages meant to be read, and start designing instruments meant to be played."

## Audit Checklist: The 4 Core Pillars
Evaluate the provided screen, wireframe, or layout against these 4 pillars:

### 1. Layout as Context, Not Just Containers
- [ ] **Check:** Does the layout use spatial reasoning rather than a flat grid fighting for attention?
- [ ] **Requirement:** Look for a three-panel layout structure mirroring the user's cognitive process:
  - Left: "What am I looking at?" (Catalog/Options)
  - Center: "What am I doing with it?" (Journey/Active task)
  - Right: "What should I know about it?" (Intelligence/Context)

### 2. Density vs. Breathability (The "Meaningful Space" Rule)
- [ ] **Check:** Is the interface crammed with data above the fold? (White space is NOT wasted space).
- [ ] **Requirement:** Space must be used as a functional tool. Look for generous padding and large typography to isolate critical decisions, group related actions, and let the UI breathe to reduce cognitive load.

### 3. Proximity of Action
- [ ] **Check:** Are actions hidden in global navigation bars or hidden contextual menus?
- [ ] **Requirement:** Actions must live immediately adjacent to the data they affect. Enforce the use of quick actions, toggle groups, and inline buttons so the interface morphs around user intent without forcing them to navigate away.

### 4. Asynchronous Independence
- [ ] **Check:** Does the whole page scroll together, causing the user to lose sight of global tools?
- [ ] **Requirement:** Enforce independent scroll areas (like `min-h-0` implementations). The user must be able to scrub through a long list (e.g., a product catalog) in one panel while maintaining their fixed place in their active journey in another, acting like pieces of paper on a physical desk.

## Output Structure
Format your review EXACTLY like this:

### Philosophy Alignment Summary
[1-2 sentences evaluating if the overall design successfully acts as an "Action Operator" workspace or fails by acting as a legacy "Information Radiator".]

### Pillar Violations & Concrete Fixes
[List specific UI elements that violate any of the 4 pillars. Provide exact recommendations to fix them (e.g., "Proximity of Action: Move the global 'Save' button inline next to the active configuration row").]

### Instrument Playability
[1 sentence on how to make this specific screen feel more like a playable instrument for the user rather than a static page to be read.]
