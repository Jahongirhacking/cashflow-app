# CLAUDE.md

# Finance — Personal Finance Management Application

## 1. Project Overview

Build a production-quality personal finance management application called **Finance**.

The application must provide:

- Web application
- Android application
- Google OAuth authentication
- User-owned Google Spreadsheet integration
- Transaction management
- Income and expense tracking
- Financial analytics
- Charts
- Fixed vs variable expense analysis
- Recurring expenses
- Investment tracking
- Uzbek voice-based transaction entry
- Modern responsive UI
- Dark/light theme
- Clean architecture
- Strong validation and error handling

The primary goal is to turn the user's existing Google Spreadsheet into a modern financial management interface.

The spreadsheet is the primary data store for the MVP.

---

# 2. Core Product Principle

The application is NOT a spreadsheet viewer.

The spreadsheet is the backend data source, while the application provides:

- clean UX
- structured data entry
- analytics
- financial insights
- charts
- investment management
- recurring expense management
- voice input
- mobile experience

The user should be able to manage their finances without directly opening Google Sheets during normal usage.

Google Sheets remains accessible as the underlying source of truth.

---

# 3. Technology Stack

## Frontend

Use:

- React Native
- Expo
- TypeScript
- Expo Router
- React Native Web
- TanStack Query
- React Hook Form
- Zod
- Zustand only where global client state is actually required
- NativeWind or another robust cross-platform styling solution
- Lucide icons
- A chart library compatible with Expo Android and Web

Use strict TypeScript.

Avoid `any`.

Do not introduce unnecessary dependencies.

---

## Backend

Use:

- NestJS
- TypeScript
- Google Sheets API
- Google OAuth
- JWT or secure session authentication
- class-validator or Zod
- REST API
- modular architecture

Backend responsibilities:

- authentication
- authorization
- user management
- spreadsheet connection
- Google Sheets API access
- transaction CRUD
- investment CRUD
- recurring expense management
- categories
- analytics
- financial calculations
- voice parsing integration if required

---

## Package Manager

Use:

```bash
pnpm
```
