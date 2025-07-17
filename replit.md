# Freightclear Workflows - Document Management System

## Overview

Freightclear Workflows is a comprehensive web application designed for freight management with OCR document intelligence and automatic data extraction. Built for Freightclear, it provides a streamlined platform for managing shipments, documents, and user accounts with a focus on imports to the USA.

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
- **Payment Processing**: Accept.js for secure credit card tokenization

### Backend Architecture

- **Server**: Express.js with TypeScript
- **Database ORM**: Drizzle with PostgreSQL dialect
- **Authentication**: Passport.js with OpenID Connect strategy
- **Session Management**: Express sessions with PostgreSQL store
- **File Handling**: Multer for multipart file uploads
- **API Structure**: RESTful endpoints with proper error handling
- **Payment Gateway**: Authorize.Net integration for subscription billing
- **Access Control**: Subscription middleware with usage limits enforcement

### Database Schema

The application uses PostgreSQL with the following main entities:

- **Users**: Store user profile information from Replit Auth with subscription fields
- **Shipments**: Core freight shipment data with tracking information
- **Documents**: File metadata linked to shipments with categorization
- **OCR Processing Jobs**: Queue system for document processing
- **Sessions**: Session storage for authentication
- **Subscription Plans**: Predefined billing plans with features and limits
- **Payment Transactions**: Record of all Authorize.Net payment transactions

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
- July 08, 2025: Removed dedicated Documents page from main navigation
- July 08, 2025: Integrated document management directly into Shipments page with tabs
- July 08, 2025: Added carrier tracking buttons for BL numbers and container numbers
- July 08, 2025: Restructured documents as subsets of shipments with dedicated folders
- July 08, 2025: Final UI simplification: removed Documents tab, embedded document folders directly in shipments table
- July 08, 2025: Removed shipment status column, streamlined table layout with collapsible document folders
- July 08, 2025: Each shipment row now expandable to show dedicated document folder with download functionality
- July 08, 2025: Implemented Power of Attorney customer profile integration with database schema
- July 08, 2025: Created POA e-signature form wizard with 4-step process and HTML document generation
- July 08, 2025: Removed validation from POA upload, created blank form template, reset all POA data
- July 08, 2025: Added PDF generation using Puppeteer for signed POA documents
- July 08, 2025: Implemented email notifications to admin users when POAs are submitted
- July 08, 2025: Created admin-level POA validation system with approve/reject functionality
- July 08, 2025: Updated POA agent information to "WCS International Inc." (removed Chris Williams)
- July 08, 2025: Added company name field to POA form and pre-filled WCS International address
- July 08, 2025: Improved database connection stability and error handling for production reliability
- July 08, 2025: Added IRS proof upload functionality to user profiles with admin verification system
- July 08, 2025: Created comprehensive IRS proof status display with red/green indicators based on verification status
- July 08, 2025: Implemented admin-level IRS proof validation system with approve/reject functionality similar to POA
- July 08, 2025: Resolved critical "Can't find variable: Upload" runtime error by systematically replacing all Upload icons with FileUp from lucide-react
- July 08, 2025: Completed comprehensive button standardization system with consistent CSS classes (btn-primary, btn-secondary, btn-outline-primary, etc.)
- July 08, 2025: Fixed icon imports across all components (DocumentUpload, PowerOfAttorneyUpload, IrsProofUpload, ShipmentDetail, landing, dashboard, admin pages)
- July 08, 2025: Application stability restored with proper error handling and consistent UI styling throughout
- July 08, 2025: Implemented "La Belle Aurore" Google font for POA electronic signature field at 14pt for authentic handwritten appearance
- July 08, 2025: Added POA deletion functionality allowing users to delete existing POAs and create new ones for testing purposes
- July 08, 2025: Fixed POA creation button visibility issues after deletion with proper status condition handling
- July 08, 2025: Renamed application from "Freight Flow" to "Freightclear Importer Workflow" across all UI components, server templates, and documentation
- July 08, 2025: Updated application name from "Freightclear Importer Workflow" to "Freightclear Workflows" for simplified branding
- July 08, 2025: Fixed button visibility issues in document upload dialog by standardizing button CSS classes with explicit visibility properties
- July 15, 2025: Implemented comprehensive subscription-based access control system using Authorize.Net for monthly billing
- July 15, 2025: Created subscription plans simplified to 2-tier system: Free and Pro ($175/month) with usage limits
- July 15, 2025: Added database schema for user subscriptions with trial periods, payment tracking, and usage monitoring
- July 15, 2025: Transformed payment page into subscription management dashboard with plan selection and billing cycles
- July 15, 2025: Added subscription middleware protecting shipment and document creation routes with usage limit enforcement
- July 15, 2025: Integrated Accept.js for secure payment processing and customer profile management in Authorize.Net
- July 15, 2025: Created development demo mode bypassing authentication for testing subscription features
- July 15, 2025: Added /demo route with test user to allow feature testing without login requirements
- July 15, 2025: Simplified subscription plans to only Free and Pro ($175/month) by removing hardcoded plans from API routes and using database-stored plans exclusively
- July 15, 2025: Restructured payment interface into separate "Subscription" and "Payments" sections with dedicated routes (/subscription for plan management, /payments for invoice payments)
- July 15, 2025: Added Authorize.Net secured logos and PCI DSS compliance badges to both subscription and payments pages for enhanced trust and security assurance
- July 15, 2025: Moved Subscription to bottom of main navigation menu as lowest option
- July 15, 2025: Implemented admin authentication control system with isAdmin database field and requireAdmin middleware
- July 15, 2025: Admin section now only visible to users with admin privileges, protecting all admin routes with proper authorization
- July 15, 2025: Fixed Authorize.Net secure logo display issues by replacing external image URLs with reliable inline SVG icons and styled badges
- July 15, 2025: Fixed critical demo user authentication issues preventing document uploads and shipment creation
- July 15, 2025: Implemented getUserId helper function across all routes to handle both development demo mode and production authentication consistently
- July 15, 2025: Demo user can now successfully upload documents, create shipments, and access all subscription features for testing
- July 15, 2025: Fixed document viewing and downloading authorization issues by creating demo-compatible middleware
- July 15, 2025: All document functionality now working in demo mode: upload, view, download, and listing
- July 15, 2025: Implemented "Delivery Orders" document category and "Last Mile" sub-category system
- July 15, 2025: Added sub_category field to documents schema with database migration
- July 15, 2025: Updated document upload interface to include sub-category selection for delivery orders
- July 15, 2025: Enhanced document display components to show both category and sub-category badges
- July 15, 2025: Created dedicated sub-category options: Last Mile, Customs Clearance, Port Delivery, Warehouse Receipt, Final Delivery
- July 15, 2025: Enhanced shipment page layout with increased padding and spacing around headers and titles for better visual organization
- July 15, 2025: Added additional left margin and padding to shipment page header area per user request
- July 15, 2025: Implemented "shipping invoice" document category with dedicated display on payments page and popup viewing functionality
- July 15, 2025: Fixed sidebar branding layout: made logo larger (h-12), changed to vertical layout with "Workflows" under logo and "Streamlined Import Management" as subtitle
- July 15, 2025: Removed "Streamlined Import Management" subtitle from sidebar branding per user request
- July 15, 2025: Reorganized payments page into two-column layout: invoices card (35% width) and payment area (65% width) using CSS Grid with lg:col-span-4 and lg:col-span-8
- July 15, 2025: Enhanced payments page responsiveness with max-w-7xl container, xl:col-span-3/9 breakpoints, and improved form grid layouts with xl:grid-cols-3/4 for better space utilization
- July 15, 2025: Added detailed instruction text to IRS proof card on profile page explaining required documents for companies/LLCs vs individual importers in 11pt font
- July 15, 2025: Updated IRS proof validation to display green star icon (like POA) when validated, maintaining admin-only validation control
- July 15, 2025: Implemented comprehensive chat system with AI responses, conversation management, and real-time messaging
- July 15, 2025: Created new "Starter" subscription tier at $49/month with 20 shipments, 300 documents, and chat support access
- July 15, 2025: Updated subscription model to 3-tier system: Free (no chat), Starter ($49/month with chat), Pro ($175/month unlimited)
- July 15, 2025: Added subscription-based chat access control with upgrade prompts for Free users
- July 15, 2025: Enhanced subscription page with 3-column layout displaying all subscription tiers with clear feature comparisons
- July 15, 2025: Chat system includes contextual AI responses for shipping, customs, documents, POA, and general support questions
- July 15, 2025: Implemented admin subscription management allowing manual upgrade of any user to any plan without payment requirements
- July 15, 2025: Added subscription management UI to admin dashboard with visual plan indicators and upgrade dialog
- July 15, 2025: Enhanced admin capabilities with subscription plans API and user subscription status monitoring
- July 15, 2025: Added company name field to "Pay Invoice" form in Payments page with Authorize.Net API integration
- July 15, 2025: Company name pre-populates from user profile and gets passed to Authorize.Net billTo.company field
- July 15, 2025: Enhanced payment form layout with side-by-side cardholder name and company name fields
- July 16, 2025: Implemented "Last Mile" shipment subcategory with truck icon for port-to-door delivery document organization
- July 16, 2025: Added Last Mile transport mode to shipment creation with automatic detection for delivery order documents
- July 16, 2025: Updated document subcategory display with green truck icons for Last Mile delivery documents
- July 16, 2025: Enhanced server-side routing to automatically create Last Mile shipments (LM-prefix) from delivery order uploads
- July 16, 2025: Added automatic subcategory assignment for delivery orders to "last_mile" category
- July 16, 2025: Fixed Last Mile transport mode visibility in shipments table by adding truck emoji support
- July 16, 2025: Replaced admin subscription management cards with company name search functionality
- July 16, 2025: Admin can now search by company name, email, or user name to find and upgrade specific accounts
- July 16, 2025: Enhanced admin shipment management with document upload capability and HTML page access
- July 16, 2025: Removed value column from admin shipment list for cleaner layout
- July 16, 2025: Admin can now upload documents to any shipment and view HTML shipment data pages with copy functionality
- July 16, 2025: Implemented automatic 3.5% credit card service fee using Authorize.Net line item approach
- July 16, 2025: Service fee automatically calculated and applied to all credit card transactions
- July 16, 2025: Service fee appears as separate line item in Authorize.Net transactions with legal compliance notices
- July 16, 2025: Added pagination to admin page shipments table displaying 10 shipments at a time with Previous/Next navigation controls
- July 16, 2025: Implemented comprehensive pagination for shipments page with configurable page size options (10, 25, 50 per page)
- July 16, 2025: Added informative AI processing paragraph to shipments page header explaining automatic BL, AWB, and ISF data transformation
- July 17, 2025: Implemented comprehensive XML-based integration system for external shipment database updates with UN/EDIFACT COPRAR, COPARN, generic shipments, and container status formats
- July 17, 2025: Added XML Integration Manager to admin and agent dashboards with file upload, manual entry, templates, and monitoring capabilities
- July 17, 2025: Created server-side XML processing engine with automatic format detection and shipment creation/updates
- July 17, 2025: Changed main navigation "Chat" to "Chat/Support" to better reflect the support functionality
- July 17, 2025: Implemented comprehensive admin invoice upload system targeting specific user accounts with automatic email notifications
- July 17, 2025: Added invoice-specific database fields (invoice_number, invoice_amount, due_date, invoice_status, email_sent_at) to documents schema
- July 17, 2025: Enhanced payments page with improved invoice display showing amounts, due dates, payment status, and "Pay Now" functionality
- July 17, 2025: Created AdminInvoiceUpload component with user search, shipment linking, and customizable email notifications
- July 17, 2025: Added admin invoice management section to admin dashboard with comprehensive file upload and user targeting capabilities