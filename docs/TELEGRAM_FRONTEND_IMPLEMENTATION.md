# Telegram First Login - Frontend Implementation

## ✅ Implementation Complete

The frontend JavaScript has been updated to handle the Telegram web token exchange and JWT session management.

## Changes Made

### 1. Added JWT Token Variable
**File:** `public/index.html` (line ~1256)
```javascript
let jwtToken = null;  // Stores JWT session token
```

### 2. Telegram Web Token Exchange Handler
**File:** `public/index.html` (lines ~1768-1807)

This IIFE (Immediately Invoked Function Expression) runs on page load and:
- Detects `?wt=TOKEN&username=@user` URL parameters
- Calls `GET /api/auth/web-token?wt=TOKEN` to exchange temporary token for JWT
- Stores JWT in `localStorage.setItem('jwt', data.jwt)`
- Stores user data in `localStorage.setItem('user', JSON.stringify(data.user))`
- Cleans URL with `window.history.replaceState()`
- Redirects to `/cabinet` on success
- Shows error alert on failure and redirects to `/`

**Example Flow:**
```
User clicks button on Telegram: "🔑 Войти в кабинет"
         ↓
Browser loads: https://yourdomain.com/?wt=abc123...&username=@johndoe
         ↓
handleTelegramWebToken() detects parameters
         ↓
Calls: GET /api/auth/web-token?wt=abc123...
         ↓
Server returns: { success: true, jwt: "eyJ...", user: {...} }
         ↓
Stores in localStorage + redirects to /cabinet
         ↓
✅ User logged in and in cabinet
```

### 3. JWT Initialization on Page Load
**File:** `public/index.html` (lines ~1809-1825)

This IIFE runs when page loads and:
- Reads JWT from `localStorage.getItem('jwt')`
- Parses user data from localStorage
- Sets user mode to 'partner' if user has active status
- Automatically restores session if JWT exists

### 4. Helper Function for API Calls
**File:** `public/index.html` (lines ~1751-1764)

```javascript
function getFetchOptions(method, body) {
  var opts = {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' }
  };
  if (jwtToken) {
    opts.headers['Authorization'] = 'Bearer ' + jwtToken;
  }
  if (body) {
    opts.body = JSON.stringify(body);
  }
  return opts;
}
```

This helper adds JWT token to all API requests automatically when available.

## Backend Integration

The backend `/api/auth/web-token` endpoint (server.js, line 432) is already fully implemented:

✅ Validates temporary web_token  
✅ Checks TTL (10 minutes)  
✅ Finds partner by Telegram username  
✅ Generates JWT session token (7-day expiration)  
✅ Returns user data in response  
✅ Deletes used token (one-time use)  

## Complete Flow - Step by Step

### Scenario A: First Time Partner Login

1. **User clicks "Войти через Telegram"** on login page
   - Redirects to `t.me/BitbonPartnerBot`

2. **Telegram Bot `/start` handler** (telegram-bot.js, line 106)
   - Checks partner exists with active status
   - Generates web_token (TTL: 10 minutes)
   - Sends inline button with link: `https://domain.com/?wt=TOKEN&username=@user`

3. **User clicks button in Telegram**
   - Browser loads page with URL parameters

4. **Frontend handleTelegramWebToken()** detects and processes:
   ```javascript
   GET /api/auth/web-token?wt=abc123...
   ```

5. **Server responds with:**
   ```json
   {
     "success": true,
     "jwt": "eyJhbGciOiJIUzI1NiIs...",
     "user": {
       "id": "prt_xxx",
       "fullName": "John Doe",
       "email": "john@example.com",
       "telegram": "@johndoe",
       "status": "active",
       "packageType": "pro",
       "requestsUsed": 150,
       "requestsLimit": 500,
       "metaresourcesUsed": 5,
       "metaresourcesLimit": 15,
       "expiresAt": "2026-05-25T10:00:00Z"
     }
   }
   ```

6. **Frontend stores and redirects:**
   - `localStorage.setItem('jwt', sessionToken)`
   - `localStorage.setItem('user', userObject)`
   - `window.location.href = '/cabinet'`

7. **✅ User enters /cabinet with JWT session**
   - JWT loaded from localStorage by initJWT()
   - User mode set to 'partner'
   - API calls include Authorization header

## Testing Instructions

### Manual Test (via Terminal)

```bash
# 1. Generate a test partner with active status in DB
# 2. Create web_token manually via:
curl -X POST http://localhost:3000/api/admin/generate-web-token \
  -H "Content-Type: application/json" \
  -d '{"username":"@testuser"}'

# 3. Open in browser:
# http://localhost:3000/?wt=TOKEN&username=@testuser

# 4. Check localStorage in DevTools:
# - jwt should contain session token
# - user should contain parsed user object
```

### Real Test Flow

1. Have a partner with `status: "active"` in the database
2. They click Telegram bot `/start` command
3. Bot generates web_token and shows button
4. Click button → browser loads with `?wt=TOKEN`
5. Frontend exchanges for JWT
6. Verify in DevTools → Storage → localStorage:
   - `jwt: eyJ...` (session token)
   - `user: {"id":"prt_xxx",...}` (user data)
7. User is redirected to `/cabinet` with active session

## Security Features

✅ **One-time use tokens** - deleted after exchange  
✅ **10-minute TTL** - tokens expire automatically  
✅ **7-day JWT session** - separate from web_token  
✅ **Username verification** - must exist in Telegram  
✅ **Partner status check** - only active partners allowed  
✅ **Bearer token in Authorization** - standard JWT pattern  

## Environment Variables Required

```bash
SITE_URL=http://localhost:3000              # For development
# or
SITE_URL=https://yourdomain.com             # For production

TELEGRAM_BOT_TOKEN=123456:ABC-DEF...        # Telegram bot token
TELEGRAM_BOT_USERNAME=BitbonPartnerBot      # Bot username
TELEGRAM_ADMIN_CHAT_ID=123456789            # Admin notifications
```

## Files Modified

- ✅ `public/index.html` - Added frontend authentication handler
- ✅ `server.js` - Already has `/api/auth/web-token` endpoint
- ✅ `src/telegram-bot.js` - Already has web_token generation

## Next Steps (Optional)

- [ ] Add logout endpoint to delete JWT from client
- [ ] Add rate limiting on `/api/auth/web-token`
- [ ] Implement CSRF token protection for POST operations
- [ ] Add refresh token mechanism for long sessions
- [ ] Implement session timeout warnings

---

**Status:** ✅ Implementation complete and ready for testing  
**Date:** 2026-04-25
