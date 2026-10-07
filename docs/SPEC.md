You are a senior full-stack engineer and product designer.

Build a production-quality personal finance management application called "Finance".

The application must work on:

1. Web
2. Android

Use one shared TypeScript codebase.

IMPORTANT:
Do not build a simple demo or static UI.
Build a real working application with authentication, Google Sheets integration, CRUD operations, analytics, voice input, responsive UI, error handling, loading states, validation, and clean architecture.

==================================================
PRODUCT GOAL
==================================================

This application is a modern personal finance manager.

Google Sheets is the primary data store for the MVP.

The user already has an existing Google Spreadsheet containing financial transactions.

The app must:

- read existing data from Google Sheets
- write new transactions to Google Sheets
- update transactions
- delete transactions
- calculate financial analytics from the spreadsheet data
- manage investments
- identify recurring/fixed expenses
- identify variable expenses
- provide charts and financial insights
- support manual transaction entry
- support Uzbek voice-to-text transaction entry
- support Google OAuth authentication

The application should feel like a modern financial mobile app, not like a spreadsheet wrapper.

==================================================
TECH STACK
==================================================

Frontend:

- React Native
- Expo
- TypeScript
- Expo Router
- React Native Web
- TanStack Query
- React Hook Form
- Zod
- Zustand where global client state is necessary
- NativeWind or a similarly clean cross-platform styling system
- Lucide icons or another lightweight icon library
- A reliable charting library compatible with Expo Web and Android

Backend:

- NestJS
- TypeScript
- Google Sheets API
- Google OAuth
- JWT or secure session-based authentication
- Zod/class-validator for validation
- Clean modular architecture

Package manager:

- pnpm

Use strict TypeScript.

Do not use `any` unless absolutely unavoidable.

==================================================
ARCHITECTURE
==================================================

Use this architecture:

Mobile/Web Client
|
| HTTPS
v
NestJS Backend
|
v
Google Sheets API
|
v
Google Spreadsheet

Never expose Google service-account credentials or Google Sheets API secrets to the frontend.

The frontend must communicate with the backend API.

The backend is responsible for:

- authentication
- authorization
- Google Sheets access
- spreadsheet CRUD
- business logic
- analytics
- financial calculations
- voice-parser API if needed

==================================================
AUTHENTICATION
==================================================

Implement:

- Google OAuth login
- Logout
- Persistent authentication
- Protected routes
- Current-user endpoint
- Secure token/session handling
- Auth loading state
- Unauthorized handling

UI:

"Continue with Google"

After login, redirect to Dashboard.

Do not request unnecessary Google permissions.

Use the minimum Google permissions required for the application.

==================================================
GOOGLE SHEETS
==================================================

The existing spreadsheet should be treated as the database.

Make the spreadsheet ID configurable through environment variables.

Example:

GOOGLE_SPREADSHEET_ID=...

Do not hardcode secrets.

Use a backend Google Sheets service.

Create a clean abstraction:

GoogleSheetsService

with methods such as:

- getTransactions()
- getTransactionById()
- createTransaction()
- updateTransaction()
- deleteTransaction()
- getInvestments()
- createInvestment()
- updateInvestment()
- deleteInvestment()
- getCategories()
- getUsers()
- getSettings()

Do not scatter Google Sheets API calls throughout controllers.

Controllers should call services.

==================================================
SPREADSHEET STRUCTURE
==================================================

Support these sheets:

1. Transactions
2. Investments
3. Categories
4. Users
5. Settings

If the existing spreadsheet has different names or columns, create a configurable column mapping layer rather than destroying the existing structure.

The existing transaction structure is approximately:

A: To'lov Nomi
B: Narx (+ Kirim / - Chiqim)
C: To'lov turi (N/P)
D: Sana
E: Vaqt
F: Kategoriya

There are also summary cells for:

Naqd
Plastik
Jami
Chiqim
Kirim

Preserve the existing spreadsheet data.

Do not rewrite or delete existing rows during initialization.

==================================================
TRANSACTION MODEL
==================================================

Use a normalized internal model:

Transaction:

- id
- name
- amount
- type
- paymentMethod
- date
- time
- category
- note
- isRecurring
- recurringRuleId
- createdAt
- updatedAt
- userId

Transaction type:

INCOME
EXPENSE

Amount should be normalized internally as a positive number.

Do NOT use negative numbers as the primary business representation.

Instead:

type = EXPENSE
amount = 50000

or:

type = INCOME
amount = 5000000

When writing to the legacy spreadsheet format, convert EXPENSE to negative and INCOME to positive.

==================================================
PAYMENT METHODS
==================================================

Support:

- CASH
- CARD
- BANK
- OTHER

Map them to the existing spreadsheet payment-type representation where necessary.

==================================================
CATEGORIES
==================================================

Provide default categories:

Income:

- Salary
- Bonus
- Freelance
- Business
- Other Income

Expenses:

- Food
- Transport
- Housing
- Utilities
- Family
- Credit
- Subscription
- Shopping
- Education
- Health
- Entertainment
- Other

Allow users to create custom categories.

==================================================
DASHBOARD
==================================================

Create a clean modern dashboard.

Display:

- Total balance
- Total income
- Total expenses
- Savings
- Savings rate
- Current month spending
- Previous month comparison
- Recent transactions
- Upcoming recurring expenses
- Investment summary

Example:

Total balance
25,381,420 so'm

Income
17,413,296 so'm

Expenses
8,245,600 so'm

Savings
9,167,696 so'm

Savings rate
52.6%

Use compact cards.

Do not overload the dashboard.

==================================================
TRANSACTIONS SCREEN
==================================================

Create:

/transactions

Features:

- list transactions
- search
- filter by category
- filter by income/expense
- filter by payment method
- filter by date
- sort newest/oldest
- edit
- delete
- create transaction

Use pagination or virtualization if needed.

Show transaction amounts clearly:

Income:
+17,413,296 so'm

Expense:
-42,280 so'm

==================================================
ADD TRANSACTION
==================================================

Create a beautiful bottom sheet/modal/form.

Fields:

- type
- amount
- name
- category
- payment method
- date
- time
- note

Provide:

[Manual entry]

and

[Voice entry]

The form must validate input before submission.

After successful creation:

1. Write to Google Sheets through backend.
2. Invalidate/refetch TanStack Query data.
3. Show success feedback.
4. Close the form.

==================================================
UZBEK VOICE INPUT
==================================================

Support Uzbek speech-to-text.

Example user speech:

"Bugun ovqatga ellik ming so'm sarfladim"

or:

"Metroga ikki ming besh yuz so'm ketdi"

Convert speech into text.

Then parse the text into a transaction draft.

Example:

Input:
"Bugun metroga 2500 so'm sarfladim"

Draft:

{
type: "EXPENSE",
amount: 2500,
name: "Metro",
category: "Transport",
date: today
}

IMPORTANT:

Voice recognition must NEVER automatically write to the spreadsheet.

Always show a confirmation screen first.

Example:

Detected transaction

Metro
-2,500 so'm
Transport
Today

[Cancel] [Add transaction]

Allow the user to edit the parsed result before saving.

If Uzbek native speech recognition is unavailable on a platform, provide a graceful fallback and keep manual entry fully functional.

==================================================
ANALYTICS
==================================================

Create:

/analytics

Provide:

1. Income vs Expenses
2. Monthly cash flow
3. Spending by category
4. Spending trends
5. Savings rate
6. Average daily spending
7. Fixed vs variable expenses
8. Recurring expenses
9. Month-over-month comparison

Charts must be readable and minimal.

Do not create unnecessarily complicated dashboards.

==================================================
FIXED VS VARIABLE EXPENSES
==================================================

Automatically classify expenses.

Fixed examples:

- rent
- loan payments
- subscriptions
- recurring bills
- regular monthly payments

Variable examples:

- food
- transport
- shopping
- entertainment
- miscellaneous

Do not require AI for the initial implementation.

Use deterministic rules and recurring transaction patterns.

Allow users to manually override classification.

==================================================
RECURRING EXPENSES
==================================================

Create:

/recurring

Display:

- expense name
- amount
- frequency
- next payment date
- category
- active/inactive

Example:

Kia Credit
3,760,000 so'm
Every month
18th

Claude
670,000 so'm
Every month
3rd

Allow:

- create
- edit
- pause
- delete

==================================================
INVESTMENTS
==================================================

Create:

/investments

Show:

- total invested
- current value
- total profit
- total return %
- individual investments

Investment model:

- id
- name
- type
- investedAmount
- currentValue
- startDate
- expectedRate
- actualProfit
- status
- note

Investment types:

- Deposit
- Stock
- Crypto
- Gold
- Business
- Other

Create investment details screen.

Support basic calculations:

profit = currentValue - investedAmount

returnPercent =
profit / investedAmount \* 100

==================================================
FINANCIAL INSIGHTS
==================================================

Generate useful deterministic insights.

Examples:

"Your expenses increased 12% compared with last month."

"Credit payments represent 45% of your monthly expenses."

"Your average daily spending is 274,000 so'm."

"Your current savings rate is 52.6%."

"You are projected to save approximately 8.7M so'm this month."

Do not generate fake insights when there is insufficient data.

Clearly handle empty states.

==================================================
NAVIGATION
==================================================

Mobile bottom navigation:

Home
Transactions
Add
Analytics
More

Desktop:

Sidebar navigation:

Dashboard
Transactions
Recurring
Investments
Analytics
Categories
Settings

The navigation should adapt between mobile and desktop.

==================================================
DESIGN SYSTEM
==================================================

Design direction:

- modern
- minimal
- compact
- premium
- financial dashboard style
- excellent typography
- generous but controlled spacing
- subtle borders
- subtle shadows
- rounded cards
- strong visual hierarchy
- no excessive gradients
- no unnecessary animations
- no excessive emojis

Use a restrained color system.

Income:
green semantic color.

Expense:
red semantic color.

Neutral:
gray/black/white.

Support both light and dark themes.

==================================================
RESPONSIVE WEB
==================================================

The same application must work on:

- desktop
- tablet
- mobile browser

Desktop should use a sidebar.

Mobile should use bottom navigation.

Do not simply stretch the mobile UI across desktop.

Create responsive layouts.

==================================================
ANDROID
==================================================

The Android application must use the same business logic and API.

Use Expo/EAS compatible architecture.

Make sure the project can produce:

- development Android build
- production APK/AAB

Do not introduce libraries that only work on web unless wrapped in platform-specific modules.

Use Expo platform-specific files when necessary.

==================================================
DATA FETCHING
==================================================

Use TanStack Query.

Examples:

useTransactions()
useTransaction()
useCreateTransaction()
useUpdateTransaction()
useDeleteTransaction()

useInvestments()
useAnalytics()
useRecurringExpenses()

After mutation:

- invalidate relevant queries
- update UI
- show feedback

Handle:

- loading
- error
- empty
- success

states everywhere.

==================================================
ERROR HANDLING
==================================================

Backend:

- centralized exception handling
- structured API errors
- validation errors
- Google API errors
- authentication errors

Frontend:

- global error boundary
- toast/snackbar feedback
- retry actions
- meaningful empty states

Never show raw backend errors to users.

==================================================
API DESIGN
==================================================

Create REST endpoints similar to:

POST /auth/google
GET /auth/me
POST /auth/logout

GET /transactions
POST /transactions
GET /transactions/:id
PATCH /transactions/:id
DELETE /transactions/:id

GET /analytics/overview
GET /analytics/monthly
GET /analytics/categories
GET /analytics/fixed-variable

GET /investments
POST /investments
GET /investments/:id
PATCH /investments/:id
DELETE /investments/:id

GET /recurring
POST /recurring
PATCH /recurring/:id
DELETE /recurring/:id

GET /categories
POST /categories
PATCH /categories/:id
DELETE /categories/:id

==================================================
SECURITY
==================================================

Important:

- never expose Google credentials to frontend
- never hardcode secrets
- validate all incoming data
- protect all private API endpoints
- verify authenticated user
- do not trust userId from request body
- derive user identity from authentication
- sanitize spreadsheet input
- implement rate limiting where appropriate
- use secure HTTP-only cookies or another secure token strategy for web
- use secure token storage on Android

==================================================
GOOGLE SHEETS CONCURRENCY
==================================================

Because Google Sheets is being used as the database:

- minimize unnecessary API requests
- batch reads where possible
- batch writes where possible
- avoid reading the entire spreadsheet for every UI interaction
- cache read-heavy data using TanStack Query
- invalidate queries after writes
- handle Google API rate limits gracefully
- use consistent row identifiers

Do not create duplicate transactions when a request is retried.

Use an internal transaction ID.

==================================================
EXISTING SPREADSHEET COMPATIBILITY
==================================================

The user already has financial data.

Do not destroy or migrate the existing spreadsheet blindly.

First inspect the existing structure.

Create a spreadsheet adapter that maps:

existing columns
↓
internal Transaction model
↓
application UI

The app must be able to read the existing rows.

Existing data must remain intact.

==================================================
FOLDER STRUCTURE
==================================================

Use a clean monorepo:

finance/
apps/
mobile/
api/
packages/
shared/
types/
config/

Or another clean architecture if you have a better reason.

Shared types should be reusable between frontend and backend where practical.

==================================================
ENVIRONMENT VARIABLES
==================================================

Create example environment files.

Frontend:

EXPO_PUBLIC_API_URL=

Backend:

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
JWT_SECRET=

Never commit real secrets.

Provide:

.env.example

==================================================
UX DETAILS
==================================================

Every important action must have feedback.

Examples:

Saving transaction...
Transaction added
Unable to save transaction
Retry

Deleting:

Delete this transaction?

[Cancel] [Delete]

Loading:

Use skeleton loaders instead of blank screens.

Empty state:

No transactions yet.

Add your first transaction using the + button.

==================================================
PERFORMANCE
==================================================

Avoid unnecessary renders.

Use:

- TanStack Query caching
- memoization only where useful
- FlatList/FlashList for long transaction lists
- debounced search
- pagination/virtualization
- batched Sheets API operations

Do not prematurely optimize.

==================================================
ACCESSIBILITY
==================================================

Buttons must have accessible labels.

Inputs must have labels.

Ensure sufficient contrast.

Support keyboard navigation on web.

==================================================
IMPLEMENTATION STRATEGY
==================================================

Do not try to implement everything blindly in one giant step.

Work in phases.

PHASE 1:

- initialize project
- Expo
- TypeScript
- Expo Router
- NestJS backend
- shared types
- environment configuration

PHASE 2:

- Google OAuth
- authentication
- protected routes

PHASE 3:

- Google Sheets integration
- spreadsheet adapter
- read existing transactions

PHASE 4:

- transaction CRUD
- dashboard

PHASE 5:

- analytics
- charts
- fixed vs variable expenses

PHASE 6:

- recurring expenses

PHASE 7:

- investments

PHASE 8:

- Uzbek voice input
- speech parsing
- confirmation flow

PHASE 9:

- responsive desktop UI
- Android-specific testing
- error handling
- performance

PHASE 10:

- production build configuration
- Android APK/AAB
- web production build

After each phase:

1. run type checking
2. run lint
3. run tests where available
4. fix errors
5. verify the application still works

==================================================
IMPORTANT CODING RULES
==================================================

Do not generate fake/mock production data unless explicitly needed for UI previews.

Do not replace Google Sheets with an in-memory database.

Do not use localStorage as the primary database.

Do not expose service-account credentials.

Do not put business logic directly inside React components.

Do not put Google Sheets API calls inside controllers.

Use services/repositories/adapters.

Keep components small.

Use meaningful names.

Use strict TypeScript.

Avoid `any`.

Use reusable components.

Use feature-based organization where appropriate.

==================================================
FIRST TASK
==================================================

Before implementing the full application:

1. Inspect the current repository.
2. Determine whether a project already exists.
3. Inspect package.json and existing architecture.
4. Inspect all existing source files relevant to the application.
5. Do not overwrite an existing project blindly.
6. Propose the final architecture based on the current repository.
7. Then implement Phase 1.

If the repository is empty, initialize the project from scratch.

At the end of Phase 1 provide:

- architecture summary
- created files
- installation commands
- environment variables required
- commands to run web
- commands to run Android
- commands to run backend
- known limitations

Then continue to Phase 2 only after Phase 1 is working correctly.

==================================================
GOOGLE AUTH + USER SPREADSHEET CONNECTION FLOW
==================================================

The authentication and spreadsheet connection flow must work as follows.

IMPORTANT ARCHITECTURE:

Google OAuth is used ONLY to authenticate the user.

Google Sheets data access is performed by the backend using a
Google service account.

The service account email is configured through:

GOOGLE_SERVICE_ACCOUNT_EMAIL

Example:

examplebot@gmail.com

The user must explicitly share their Google Spreadsheet with this
service-account email and grant Editor permission.

Do NOT require the user to give the application their Google
password.

Do NOT expose the service account credentials to the frontend.

Do NOT store the user's Google Sheets access token as the primary
mechanism for spreadsheet access.

==================================================
FIRST LOGIN FLOW
==================================================

When a user signs in with Google for the first time:

1. Authenticate the user with Google OAuth.
2. Create/find the application user.
3. Check whether the user has a connected spreadsheet.
4. If no spreadsheet is connected, redirect to:

/setup/spreadsheet

Do NOT redirect directly to the dashboard.

==================================================
SPREADSHEET SETUP WIZARD
==================================================

Create a clean 4-step setup wizard.

Step 1:
"Create your Google Spreadsheet"

Explain:

"Finance stores your financial data in your own Google Spreadsheet."

Provide a button:

[Open Google Sheets]

Link to:

https://sheets.google.com/

Then:

[I've created my spreadsheet]

==================================================
STEP 2: SHARE SPREADSHEET
==================================================

Display the application's configured service-account email.

Example:

examplebot@gmail.com

Display:

"Share your spreadsheet with this email and give it Editor access."

Provide:

[Copy email]

Instructions:

1. Open your spreadsheet.
2. Click Share.
3. Add the Finance service-account email.
4. Select Editor.
5. Click Send.

Button:

[I've shared it]

Do not hardcode examplebot@gmail.com in application code.

Read it from configuration.

==================================================
STEP 3: ENTER SPREADSHEET URL
==================================================

Ask:

"Paste your Google Spreadsheet URL"

Input example:

https://docs.google.com/spreadsheets/d/1abc.../edit

Button:

[Connect Spreadsheet]

Validate that the value is a valid Google Sheets URL.

Send:

POST /spreadsheets/connect

Request:

{
"spreadsheetUrl": "..."
}

The backend must extract the spreadsheet ID from the URL.

Do not trust a spreadsheet ID supplied separately by the frontend.

==================================================
STEP 4: VERIFY ACCESS
==================================================

The backend must verify that the service account can actually access
the spreadsheet.

Use the Google Sheets API to attempt to read spreadsheet metadata.

If access fails:

Return a clear error such as:

{
"code": "SPREADSHEET_ACCESS_DENIED",
"message": "The Finance app cannot access this spreadsheet."
}

Frontend should show:

"Unable to access your spreadsheet.

Make sure that:

✓ The URL is correct
✓ examplebot@gmail.com has Editor access
✓ The spreadsheet still exists

[Try again]"

Do not expose raw Google API errors to the user.

If access succeeds:

Continue automatically.

==================================================
SPREADSHEET INITIALIZATION
==================================================

After successfully connecting the spreadsheet:

Inspect its existing sheets.

Do NOT delete existing sheets.

Do NOT delete existing rows.

Do NOT overwrite existing financial data.

If required application sheets are missing, create them.

Required sheets:

- Transactions
- Investments
- Recurring
- Categories
- Settings

If the existing spreadsheet already contains a compatible
transaction sheet, reuse it.

==================================================
EXISTING SPREADSHEET COMPATIBILITY
==================================================

The user may already have a spreadsheet with thousands of existing
financial transaction rows.

The application MUST preserve existing data.

The current legacy transaction format is approximately:

Column A:
To'lov Nomi

Column B:
Narx (+ Kirim / - Chiqim)

Column C:
To'lov turi (N/P)

Column D:
Sana

Column E:
Vaqt

Column F:
Kategoriya

The application must create a spreadsheet adapter/mapping layer.

Example:

Legacy Spreadsheet Row
↓
SpreadsheetAdapter
↓
Internal Transaction model
↓
Application UI

When writing transactions back:

INCOME:
positive spreadsheet amount

EXPENSE:
negative spreadsheet amount

Internally, however, always use:

{
type: "EXPENSE",
amount: 50000
}

rather than storing negative amounts in the internal domain model.

==================================================
STORE CONNECTION
==================================================

After successful verification, store the spreadsheet ID against the
authenticated user.

Example:

User:

{
id,
googleId,
email,
name,
spreadsheetId
}

The spreadsheet ID is application data and must never be accepted
from an unauthenticated request.

==================================================
SUBSEQUENT LOGIN
==================================================

On subsequent Google logins:

1. Authenticate user.
2. Load user profile.
3. Check spreadsheetId.

If spreadsheetId exists:

Go directly to Dashboard.

If spreadsheetId does not exist:

Go to:

/setup/spreadsheet

==================================================
LOST ACCESS
==================================================

If a previously connected spreadsheet becomes inaccessible because
the user removed the service account permission:

Do not permanently break the application.

Detect the Google Sheets permission error.

Show:

"Spreadsheet access lost"

"Please restore Editor access for
examplebot@gmail.com."

Buttons:

[Reconnect]
[Open Settings]

The user should be able to reconnect a different spreadsheet.

==================================================
SETTINGS
==================================================

Create:

Settings → Spreadsheet

Show:

Connection status:
Connected ✓

Spreadsheet:
[Spreadsheet name]

Last verified:
[date/time]

Actions:

[Open Spreadsheet]
[Reconnect Spreadsheet]
[Verify Connection]

Do not display service account private credentials.

==================================================
BACKEND ENDPOINTS
==================================================

Create:

GET /spreadsheets/status

POST /spreadsheets/connect

POST /spreadsheets/verify

POST /spreadsheets/reconnect

GET /spreadsheets/info

The backend should contain a dedicated:

SpreadsheetService

and:

GoogleSheetsService

GoogleSheetsService:

- authenticates as service account
- communicates with Google Sheets API
- reads/writes spreadsheet data

SpreadsheetService:

- handles user spreadsheet connection
- validates spreadsheet ownership/access relationship
- extracts spreadsheet IDs
- initializes required sheets
- stores connection metadata

Controllers must remain thin.

==================================================
GOOGLE SERVICE ACCOUNT SECURITY
==================================================

Use environment variables:

GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SPREADSHEET_ID=

However, do NOT use a global GOOGLE_SPREADSHEET_ID for user-specific
spreadsheets in production.

The user's spreadsheet ID must be stored per authenticated user.

The service-account email may be global.

The private key must exist only on the backend.

Never send the private key to the frontend.

Never commit credentials.

==================================================
IMPORTANT
==================================================

The user's Google account and the application's service account are
two different identities.

Google OAuth answers:

"Who is this user?"

The service account answers:

"Can the Finance backend access this spreadsheet?"

Keep these responsibilities separate.
