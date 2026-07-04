---
name: plan_env_switch
description: Plan to implement runtime environment switch (prod / Test-Gui / Test-Tere) between Supabase projects
type: project
---

We will implement Option A — a runtime UI toggle to switch between Supabase environments.

**Why:** Needed for safe development without touching prod data. Each environment = separate Supabase project with its own URL+anon_key.

**How to apply:**
- 3 sets of VITE_ env vars bundled in the build (URL + anon_key per env)
- On app load: read `localStorage.getItem('env')` → create Supabase client with matching credentials
- A small visible selector in the admin UI → sets localStorage → `window.location.reload()`
- Anon keys are public by design (RLS protects data) — safe to bundle
- User (gui) needs to create 2 new Supabase projects: Test-Gui and Test-Tere, run schema.sql on each

**Status:** Planned, not yet implemented. Do the DB audit + RLS fixes first.
