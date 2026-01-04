# JWT API Express Client

A modern Next.js frontend application that consumes the [JWT API Express](../jwt-api-express) backend. This project demonstrates best practices for authentication in Next.js Server Actions, cookie management, and secure API communication.

## Features

- **Next.js 15 App Router**: Modern React framework with App Router architecture
- **Server Actions**: Type-safe server-side mutations and data fetching
- **JWT Authentication**: Secure token-based authentication with httpOnly cookies
- **Cookie Management**: Custom utilities for handling authentication cookies in Server Actions
- **shadcn/ui Components**: Beautiful, accessible UI components built with Radix UI and Tailwind CSS
- **TypeScript**: Full type safety throughout the codebase

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI)
- **Authentication**: JWT via httpOnly cookies
- **Backend API**: [JWT API Express](../jwt-api-express)

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Dashboard page (protected)
│   ├── page.tsx           # Home/Login page
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── login-form.tsx    # Login form component
├── lib/                   # Utility libraries
│   ├── auth.ts           # Authentication utilities for Server Actions
│   └── utils.ts          # General utilities (cn helper)
├── server/                # Server Actions
│   ├── login-action.ts           # Login Server Action
│   └── get-users-stats-action.ts # Get stats Server Action
└── hooks/                 # Custom React hooks
```

## Authentication Implementation with Transparent Token Refresh

### Overview

This application implements a **transparent refresh token system** that automatically renews expired access tokens without user intervention. The user never knows when their token expires - they just continue using the application seamlessly.

**Key Features:**

- **Automatic Token Refresh**: When access token expires (15 min), it's automatically renewed
- **Zero User Disruption**: No login prompts, no loading states, completely transparent
- **Token Rotation**: Security feature that rotates refresh tokens on every use (7-day lifetime)
- **Secure Storage**: Both tokens stored as httpOnly cookies

### The Server Actions Cookie Problem

Next.js Server Actions execute on the **Next.js server**, not in the browser. This creates a unique challenge when working with httpOnly cookies:

**The Issue:**

```
Browser → Next.js Server Action → Express Backend
```

When a Server Action makes a `fetch` request to the Express backend:

- The browser's cookies are NOT automatically sent
- `credentials: 'include'` only works for browser → server requests
- The Next.js server doesn't have access to the browser's cookies

**The Solution:**

We created custom utilities in `lib/auth.ts` to manually handle cookie propagation between Next.js and the Express backend.

### Cookie Management Utilities (`lib/auth.ts`)

#### 1. `extractAndSetCookies(setCookieHeaders: string[])`

Extracts **BOTH tokens** (access + refresh) from the Express backend's `Set-Cookie` headers (array) and stores them in Next.js cookies.

```typescript
// CRITICAL: Use getSetCookie() to get ALL headers (backend sends 2 separate headers)
const setCookieHeaders = response.headers.getSetCookie();
if (setCookieHeaders && setCookieHeaders.length > 0) {
  await extractAndSetCookies(setCookieHeaders);
}
```

**Why it's needed:**

- Server Actions don't automatically store cookies from backend responses
- Backend sends **TWO separate Set-Cookie headers** (one per token)
- Must use `getSetCookie()` not `get('set-cookie')` to capture BOTH
- Access token expires in 15 minutes, refresh token in 7 days

#### 2. `getAuthToken()` & `getRefreshToken()`

Retrieve the access token and refresh token from Next.js cookies.

```typescript
const accessToken = await getAuthToken();
const refreshToken = await getRefreshToken();
```

#### 3. `getAuthHeaders()`

Generates HTTP headers with **BOTH** authentication cookies for backend requests.

```typescript
const headers = await getAuthHeaders();
// Returns headers including: Cookie: access_token=xxx; refresh_token=yyy
```

#### 4. `requireAuth()`

Validates that an access token exists, throwing an error if not.

```typescript
await requireAuth(); // Throws error if no token
```

#### 5. `clearAuthCookies()`

Removes both tokens from Next.js cookies (used during logout).

```typescript
await clearAuthCookies();
```

#### 6. 🌟 `fetchWithAuth()` - **The Magic Function**

**This is the key to transparent token refresh.** It's a wrapper around `fetch` that automatically handles token refresh when the access token expires.

```typescript
const response = await fetchWithAuth(url, options);
```

**How it works:**

1. Makes the request with current access token
2. **If 401 Unauthorized** (token expired):
   - Automatically calls `/api/auth/refresh` with refresh token
   - Gets new access + refresh tokens
   - Updates cookies
   - **Retries the original request** with new access token
3. Returns the response (user never knew the token expired!)

**Example:**

```typescript
// User clicks "Show Stats" after 20 minutes (access token expired)
export async function getUsersStats() {
  // NOTE: Do NOT use requireAuth() here - fetchWithAuth handles everything
  
  // fetchWithAuth handles everything automatically
  const response = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_API_URL}/api/user/stats`,
    { method: 'GET' }
  );

  // User gets their stats - they never saw an error!
  return response.json();
}
```

**What happens behind the scenes:**

```
1. User clicks button (access token expired 1 min ago)
2. fetchWithAuth tries GET /api/user/stats
3. Backend responds: 401 Unauthorized
4. fetchWithAuth automatically:
   a) POST /api/auth/refresh (with refresh token)
   b) Gets new tokens
   c) Updates cookies
   d) RETRIES GET /api/user/stats (with new token)
5. Backend responds: 200 OK
6. User sees their stats (never knew token expired!)
```

### Authentication Flow

#### 1. Login Flow

```typescript
// 1. User submits login form
const result = await login(email, password);

// 2. Server Action makes request to Express backend
const response = await fetch(`${API_URL}/api/auth/login`, {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});

// 3. Extract and store BOTH cookies from backend response
const setCookieHeaders = response.headers.getSetCookie(); // Returns array
await extractAndSetCookies(setCookieHeaders);

// 4. Both cookies are now available in Next.js context
```

#### 2. Protected Request Flow

```typescript
// 1. Validate authentication
await requireAuth();

// 2. Get headers with authentication cookie
const headers = await getAuthHeaders();

// 3. Make request to protected endpoint
const response = await fetch(`${API_URL}/api/user/stats`, {
  method: 'GET',
  headers, // Includes: Cookie: access_token=xxx
});
```

### Server Actions

#### Login Action (`server/login-action.ts`)

Handles user authentication and cookie setup.

```typescript
export async function login(email: string, password: string) {
  // 1. Call backend login endpoint
  // 2. Extract Set-Cookie header (contains access + refresh tokens)
  // 3. Store BOTH cookies in Next.js context
  // 4. Return user data
}
```

#### Get Users Stats Action (`server/get-users-stats-action.ts`)

Fetches user statistics with automatic token refresh.

```typescript
export async function getUsersStats() {
  await requireAuth();

  // fetchWithAuth handles token refresh automatically
  const response = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_API_URL}/api/user/stats`,
    { method: 'GET' }
  );

  return response.json();
}
```

**Key Change:** Using `fetchWithAuth()` instead of regular `fetch()` enables automatic token refresh.

#### Logout Action (`server/logout-action.ts`)

Logs out the user by revoking the refresh token and clearing cookies.

```typescript
export async function logout() {
  const refreshToken = await getRefreshToken();

  // Call backend to revoke refresh token
  if (refreshToken) {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshToken}`,
      },
    });
  }

  // Clear both tokens from Next.js cookies
  await clearAuthCookies();
}
```

## Why Server Actions Instead of API Routes?

Server Actions provide several advantages over traditional API Routes:

1. **Type Safety**: Direct TypeScript integration without separate API contracts
2. **Simplified Data Flow**: No need for separate client/server data fetching logic
3. **Automatic Serialization**: Next.js handles data serialization automatically
4. **Better Developer Experience**: Less boilerplate, more maintainable code
5. **Performance**: Optimized by Next.js for faster data mutations

## Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Important:** Do NOT use quotes around the URL. Next.js will include them in the variable value.

❌ **Wrong:** `NEXT_PUBLIC_API_URL='http://localhost:3001'`  
✅ **Correct:** `NEXT_PUBLIC_API_URL=http://localhost:3001`

**Note:** The backend must be running on the specified URL. See [JWT API Express](../jwt-api-express) for backend setup.

## Installation

```bash
# Using pnpm
pnpm install

# Or npm
npm install

# Or yarn
yarn install
```

## Running the Application

### Prerequisites

1. **Backend must be running**: Start [JWT API Express](../jwt-api-express) first
2. **Environment variables**: Ensure `.env.local` is configured

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Production

```bash
pnpm build
pnpm start
```

## Pages

### Home Page (`/`)

Login page with email and password form.

**Features:**

- Form validation
- Error handling
- Redirects to dashboard on successful login

### Dashboard Page (`/dashboard`)

Protected page displaying user information and stats.

**Features:**

- User information display
- Profile details
- User statistics (via protected API call)
- Logout functionality

**Protection:** Redirects to home if not authenticated (checks sessionStorage).

## UI Components

This project uses [shadcn/ui](https://ui.shadcn.com/), a collection of reusable components built with Radix UI and Tailwind CSS.

**Key components used:**

- `Button` - Interactive buttons with variants
- `Card` - Container for content sections
- `Input` - Form input fields
- `Popover` - Overlay content (used for stats display)
- And many more in `components/ui/`

## Common Issues and Solutions

### Issue: "Unauthorized" error on protected routes

**Cause:** The Server Action can't access browser cookies.

**Solution:** Ensure you're using `getAuthHeaders()` and `requireAuth()` from `lib/auth.ts` in your Server Actions.

### Issue: Cookie not being set after login

**Cause:** Not extracting the `Set-Cookie` header from backend response.

**Solution:** Use `extractAndSetCookie()` after successful login:

```typescript
const setCookieHeader = response.headers.get('set-cookie');
if (setCookieHeader) {
  await extractAndSetCookie(setCookieHeader);
}
```

### Issue: CORS errors

**Cause:** Backend CORS configuration doesn't allow requests from Next.js origin.

**Solution:** Ensure backend `app.ts` has correct CORS configuration:

```typescript
const corsOptions = {
  origin: 'http://localhost:3000', // Next.js dev server
  credentials: true,
};
```

## Transparent Token Refresh Benefits

### User Experience

1. **Zero Disruption**: User never sees login prompts due to expired tokens
2. **Seamless Sessions**: Can work for hours without re-authentication
3. **No Loading States**: Refresh happens in background, no UI changes
4. **Natural Flow**: Application feels responsive and modern

### Developer Experience

1. **Simple Integration**: Just replace `fetch` with `fetchWithAuth`
2. **No Timer Logic**: No need for `setInterval` or token expiration checks
3. **Centralized**: All refresh logic in one function
4. **Maintainable**: Easy to understand and modify

### Security

1. **Short Access Tokens**: 2-minute expiration reduces attack window
2. **Automatic Rotation**: Refresh token changes on every use
3. **Reuse Detection**: Backend revokes all sessions if stolen token is detected
4. **httpOnly Cookies**: Tokens never accessible to JavaScript (XSS protection)

### How to Use in New Server Actions

```typescript
'use server';

import { fetchWithAuth } from '@/lib/auth';

export async function myProtectedAction() {
  // fetchWithAuth handles ALL authentication + refresh automatically
  // NO need to call requireAuth() before!
  const response = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_API_URL}/api/my-endpoint`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error('Request failed');
  }

  return response.json();
}
```

**⚠️ IMPORTANT**: DO NOT use `requireAuth()` when using `fetchWithAuth()`.

- `requireAuth()` checks the access token (which may have expired)
- If the access token expired, `requireAuth()` throws an error BEFORE `fetchWithAuth()` can refresh
- `fetchWithAuth()` handles the entire authentication and refresh flow automatically

That's it! The refresh logic is completely automatic.

## Security Considerations

- **httpOnly Cookies**: Both tokens stored as httpOnly cookies (set by backend), preventing XSS attacks
- **Server-Side Validation**: All authentication logic happens on the server
- **No Token Exposure**: Tokens are never exposed to client-side JavaScript
- **Cookie Attributes**: Secure, SameSite, and appropriate expiration settings
- **Automatic Rotation**: Refresh tokens are rotated on every use
- **Token Hashing**: Tokens are hashed (SHA-256) in database
- **Reuse Detection**: Backend detects and blocks token theft attempts

## Integration with Backend

This application is designed to work with [JWT API Express](../jwt-api-express).

**Backend Endpoints Used:**

- `POST /api/auth/login` - User authentication (sets access + refresh tokens)
- `POST /api/auth/refresh` - Token refresh (automatic rotation)
- `POST /api/auth/logout` - Logout (revokes refresh token)
- `GET /api/user/stats` - User statistics (protected)

**Backend Requirements:**

- Must be running on the URL specified in `NEXT_PUBLIC_API_URL`
- Must have CORS enabled for Next.js origin
- Must set httpOnly cookies with both access and refresh tokens
- Must implement refresh token rotation system

## Documentation

For detailed information:

- **Client Implementation**: See [REFRESH_TOKEN_CLIENT.md](./REFRESH_TOKEN_CLIENT.md) for complete client-side documentation
- **Server Implementation**: See [jwt-api-express/REFRESH_TOKENS.md](../jwt-api-express/REFRESH_TOKENS.md) for backend documentation

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) - Learn about Server Actions
- [shadcn/ui](https://ui.shadcn.com/) - Learn about the UI components
- [Tailwind CSS](https://tailwindcss.com/docs) - Learn about utility-first CSS

## License

ISC

## Author

**Alejandro Otero**  
Email: aleoterob@gmail.com
