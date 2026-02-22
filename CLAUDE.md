# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Management system for a **kitesurf center in Africa**. Covers: accommodations, bookings, clients, instructors, equipment rental, accounting, external providers (taxis, activities).

**Core feature**: Interactive horizontal timeline/planning view (monthly, day-by-day with half-day granularity) showing accommodation occupancy, lessons, equipment rentals per booking.

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS (static build deployed on Hostinger)
- **Backend/DB**: Supabase Cloud (PostgreSQL, Auth, RLS, Realtime) — no custom server
- **Auth**: Supabase Auth, 2 admin accounts only (manual creation)
- **Public access**: Signed token links for read-only pages (clients, providers, taxis)

## Architecture

```
Hostinger (static)  ──Supabase SDK──►  Supabase Cloud (free tier)
React SPA                              PostgreSQL + Auth + RLS + Realtime
```

- No backend server. React app communicates directly with Supabase.
- Row Level Security (RLS) enforces access control at DB level.
- Read-only external views use signed/tokenized URLs, no account required.

## Accommodation Model

- 10 houses (2 rooms each, bookable independently, different pricing), availability varies
- ~6 bungalows
- Flexible "other" accommodations category

## Language

Project communication and UI are in **English**.

