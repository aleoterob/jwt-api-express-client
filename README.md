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

## Authentication Implementation

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

#### 1. `extractAndSetCookie(setCookieHeader: string)`

Extracts the JWT token from the Express backend's `Set-Cookie` header and stores it in Next.js cookies.

```typescript
// Used after login to capture the token from the backend
const setCookieHeader = response.headers.get('set-cookie');
if (setCookieHeader) {
  await extractAndSetCookie(setCookieHeader);
}
```

**Why it's needed:**

- Server Actions don't automatically store cookies from backend responses
- We must manually extract and save them in Next.js cookie context

#### 2. `getAuthToken()`

Retrieves the JWT token from Next.js cookies.

```typescript
const token = await getAuthToken();
// Returns the token string or undefined
```

#### 3. `getAuthHeaders()`

Generates HTTP headers with the authentication cookie for backend requests.

```typescript
const headers = await getAuthHeaders();
// Returns headers including Cookie: access_token=xxx
```

**Why it's needed:**

- Server Actions must manually include cookies in fetch requests
- The Next.js server can't automatically forward browser cookies to the backend

#### 4. `requireAuth()`

Validates that an authentication token exists, throwing an error if not.

```typescript
await requireAuth(); // Throws error if no token
```

**Use case:** Protect Server Actions that require authentication.

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

// 3. Extract and store the cookie from backend response
const setCookieHeader = response.headers.get('set-cookie');
await extractAndSetCookie(setCookieHeader);

// 4. Cookie is now available in Next.js context
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
  // 2. Extract Set-Cookie header
  // 3. Store cookie in Next.js context
  // 4. Return user data
}
```

#### Get Users Stats Action (`server/get-users-stats-action.ts`)

Fetches user statistics from protected backend endpoint.

```typescript
export async function getUsersStats() {
  // 1. Validate authentication (requireAuth)
  // 2. Get auth headers with cookie
  // 3. Fetch from backend
  // 4. Return stats data
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
NEXT_PUBLIC_API_URL=http://localhost:4000
```

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

## Security Considerations

- **httpOnly Cookies**: Tokens are stored in httpOnly cookies (set by backend), preventing XSS attacks
- **Server-Side Validation**: All authentication logic happens on the server
- **No Token Exposure**: JWT tokens are never exposed to client-side JavaScript
- **Cookie Attributes**: Secure, SameSite, and appropriate expiration settings

## Integration with Backend

This application is designed to work with [JWT API Express](../jwt-api-express).

**Backend Endpoints Used:**

- `POST /api/auth/login` - User authentication
- `GET /api/user/stats` - User statistics (protected)

**Backend Requirements:**

- Must be running on the URL specified in `NEXT_PUBLIC_API_URL`
- Must have CORS enabled for Next.js origin
- Must set httpOnly cookies with JWT tokens

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
