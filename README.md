# StoreScore

An original role-based store-rating application built for the coding challenge. It uses React, Express and PostgreSQL.

## Quick start

1. Create a PostgreSQL database, e.g. `createdb storescore`.
2. Copy `server/.env.example` to `server/.env` and set `DATABASE_URL` and `JWT_SECRET`.
3. `npm install`
4. `npm run db:migrate && npm run db:seed`
5. `npm run dev`, then open `http://localhost:5173`.

The seed command creates `admin@storescore.local` with password `Admin!2026`. Change this immediately outside local development.

## Roles

- **Administrator:** creates users/stores, sees dashboard metrics, sortable/filterable users and stores.
- **User:** self-registers, searches stores, creates or replaces their 1–5 rating, and changes password.
- **Store owner:** sees their store's average and its raters, and changes password.

## API highlights

All protected endpoints require `Authorization: Bearer <token>`. Listing query parameters are constrained server-side and use parameterized SQL. A database uniqueness constraint ensures one rating per user/store.
