# Sample Next.js API

A sample Next.js app with API routes for evaluation testing.

## Routes
- `GET /api/users` — list users
- `POST /api/users` — create user (needs Zod validation)
- `GET /api/posts` — list posts
- `POST /api/posts` — create post (needs validation)

## Sample eval tasks
1. Add Zod validation to POST /api/users
2. Add rate limiting middleware
3. Add unit test for isValidEmail helper
4. Refactor duplicated error response helpers in errors.ts
5. Add auth guard middleware to protect API routes
