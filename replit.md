# Freight Flow - Document Management System

## Overview

Freight Flow is a comprehensive web application designed for freight management with OCR document intelligence and automatic data extraction. Built for Freightclear, it provides a streamlined platform for managing shipments, documents, and user accounts with a focus on imports to the USA.

## System Architecture

The application follows a modern full-stack architecture with clear separation between frontend and backend components:

- **Frontend**: React-based SPA using Vite as the build tool
- **Backend**: Node.js/Express.js REST API server
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth integration with OpenID Connect
- **File Storage**: Local file system with multer for uploads
- **UI Framework**: Shadcn/UI components with Tailwind CSS

## Key Components

### Frontend Architecture

- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: Shadcn/UI component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom Freightclear brand colors
- **File Uploads**: React Dropzone for document uploads

### Backend Architecture

- **Server**: Express.js with TypeScript
- **Database ORM**: Drizzle with PostgreSQL dialect
- **Authentication**: Passport.js with OpenID Connect strategy
- **Session Management**: Express sessions with PostgreSQL store
- **File Handling**: Multer for multipart file uploads
- **API Structure**: RESTful endpoints with proper error handling

### Database Schema

The application uses PostgreSQL with the following main entities:

- **Users**: Store user profile information from Replit Auth
- **Shipments**: Core freight shipment data with tracking information
- **Documents**: File metadata linked to shipments with categorization
- **OCR Processing Jobs**: Queue system for document processing
- **Sessions**: Session storage for authentication

## Data Flow

1. **Authentication**: Users authenticate via Replit Auth (OpenID Connect)
2. **Session Management**: Sessions stored in PostgreSQL with automatic cleanup
3. **Document Upload**: Files uploaded via drag-and-drop interface, stored locally
4. **OCR Processing**: Documents queued for OCR processing with status tracking
5. **Data Extraction**: Processed document data linked to shipments
6. **Real-time Updates**: Client updates via TanStack Query invalidation

## External Dependencies

### Core Dependencies

- **@neondatabase/serverless**: PostgreSQL connection pooling
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **passport**: Authentication middleware
- **openid-client**: OpenID Connect implementation
- **multer**: File upload handling
- **react-dropzone**: File upload UI component

### UI Dependencies

- **@radix-ui/***: Headless UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Development Dependencies

- **vite**: Build tool and dev server
- **typescript**: Type checking
- **tsx**: TypeScript execution for server
- **esbuild**: Production bundling

## Deployment Strategy

### Development Environment

- **Frontend**: Vite dev server with HMR
- **Backend**: tsx with auto-restart
- **Database**: PostgreSQL (environment-based connection)
- **File Storage**: Local uploads directory

### Production Build

- **Frontend**: Static build output to `dist/public`
- **Backend**: ESBuild bundle to `dist/index.js`
- **Database**: Drizzle migrations applied via `db:push`
- **Environment**: Production-ready Express server

### Environment Configuration

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `REPL_ID`: Replit environment identifier
- `ISSUER_URL`: OpenID Connect issuer (defaults to Replit)
- `REPLIT_DOMAINS`: Allowed domains for authentication

## User Preferences

Preferred communication style: Simple, everyday language.

Key Features Requested:
- Focus on application features rather than customs clearance process
- Admin interface with system-wide data access
- HTML data pages with copy functionality 
- CSV export for shipments (monthly/yearly filters)
- Professional Freightclear branding alignment

## Changelog

Changelog:
- July 07, 2025: Initial setup
- July 07, 2025: Enhanced landing page with Freightclear-inspired messaging
- July 07, 2025: Added comprehensive shipment creation dialog
- July 07, 2025: Implemented admin dashboard with system-wide data access
- July 07, 2025: Added HTML copy functionality and CSV export features
- July 07, 2025: Focused application features over customs process descriptions
- July 07, 2025: Implemented complete document-based shipment creation workflow
- July 07, 2025: Added test data seeding functionality for development testing
- July 07, 2025: Enhanced transport mode selection (Air, Ocean, Trucking) with automatic detection