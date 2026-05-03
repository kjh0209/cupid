# Sample Express API

A sample Express.js REST API for evaluation testing.

## Routes
- `GET /api/users` — list users
- `GET /api/users/:id` — get user (has null check bug)
- `POST /api/users` — create user (missing validation)
- `DELETE /api/users/:id` — delete user
- `GET /api/products` — list products
- `POST /api/products` — create product (missing validation)

## Sample eval tasks
1. Fix null check bug in GET /api/users/:id
2. Add Zod request validation to POST /api/users
3. Add unit tests for helpers.ts functions
4. Refactor products route to use controller/service pattern
5. Add request logging middleware with structured output
