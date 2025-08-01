# Freightclear Workflows - Document Management System

## Overview
Freightclear Workflows is a comprehensive web application designed for freight management with OCR document intelligence and automatic data extraction. Built for Freightclear, it provides a streamlined platform for managing shipments, documents, and user accounts with a focus on imports to the USA. The system aims to automate data extraction from shipping documents like Bills of Lading, supporting key functionalities such as Fast ISF (10+2) filing, invoice management, and XML-based data exchange with external systems. It offers a robust solution for freight forwarders and importers to streamline their operations, enhance data accuracy, and improve compliance.

## User Preferences
Preferred communication style: Simple, everyday language.

Key Features Requested:
- Focus on application features rather than customs clearance process
- Admin interface with system-wide data access
- HTML data pages with copy functionality
- CSV export for shipments (monthly/yearly filters)
- Professional Freightclear branding alignment
- Comprehensive ISF document data extraction using Azure Document Intelligence (January 2025)
- Fixed critical data consolidation bug preventing comprehensive shipment data extraction (August 2025)
- Enhanced multi-document processing with improved Azure Document Intelligence integration and fallback logic

## System Architecture
The application follows a modern full-stack architecture with clear separation between frontend and backend components, featuring enhanced multi-document processing capabilities for comprehensive shipment creation.

**Frontend:**
-   **Framework**: React with TypeScript
-   **Build Tool**: Vite
-   **Routing**: Wouter
-   **State Management**: TanStack Query
-   **UI Components**: Shadcn/UI (using Radix UI primitives)
-   **Styling**: Tailwind CSS with custom Freightclear branding
-   **File Uploads**: React Dropzone
-   **Payment Processing UI**: Accept.js for credit card tokenization

**Backend:**
-   **Server**: Node.js/Express.js with TypeScript
-   **Database ORM**: Drizzle with PostgreSQL dialect
-   **Authentication**: Passport.js with OpenID Connect strategy (integrates with Replit Auth)
-   **Session Management**: Express sessions with PostgreSQL store
-   **File Handling**: Multer for multipart file uploads
-   **API Structure**: RESTful endpoints
-   **Payment Gateway**: Authorize.Net integration for subscription billing
-   **Access Control**: Subscription middleware enforcing usage limits
-   **Document Processing**: Enhanced multi-document processing system supporting simultaneous upload of up to 10 documents with intelligent data consolidation. Uses hybrid AI-powered OCR with Azure Document Intelligence as primary processor and OpenAI GPT-4o enhancement for comprehensive data extraction (supporting PDF, Excel, Word documents) with automatic ISF filing creation and intelligent field mapping. Features priority-based data consolidation from multiple documents to create complete shipments.
-   **Reporting**: CSV export for shipments
-   **XML Integration**: Server-side XML processing engine for UN/EDIFACT COPRAR, COPARN, generic shipments, and container status formats.

**Database Schema (PostgreSQL):**
-   **Users**: Stores user profiles, subscription data, and admin/agent roles.
-   **Shipments**: Core freight shipment data, including comprehensive Ocean Bill of Lading fields and XML integration fields.
-   **Documents**: File metadata linked to shipments, including categorization, sub-categories (e.g., "Last Mile"), and invoice-specific fields.
-   **OCR Processing Jobs**: Queue system for document processing.
-   **Sessions**: Authentication session storage.
-   **Subscription Plans**: Predefined billing plans (Free, Starter, Pro) with features and limits.
-   **Payment Transactions**: Records of Authorize.Net transactions and service fees.
-   **Agent Assignments**: Tracks agent-user relationships.
-   **ISF (Importer Security Filing) Data**: Stores 10+2 CBP-mandated elements.

**Key Features & Technical Implementations:**
-   **Authentication**: Replit Auth via OpenID Connect.
-   **Enhanced Multi-Document Processing**: Simultaneous upload of up to 10 documents with AI-powered data extraction and intelligent consolidation. Priority-based field mapping ensures the most accurate data from the most reliable document types (Bill of Lading > Commercial Invoice > Packing List, etc.) for complete shipment creation.
-   **Document Management**: Upload, storage, OCR processing, data extraction (B/L, AWB, ISF), and linking to shipments.
-   **Shipment Management**: Creation, tracking, and detailed data storage including auto-extracted data.
-   **Subscription Management**: Tiered plans (Free, Starter, Pro) with usage limits, trial periods, and secure payment processing via Authorize.Net and Accept.js. Includes a 3.5% credit card service fee.
-   **User Roles**: Admin and Agent roles with specific access controls and dashboards.
-   **POA (Power of Attorney) Management**: E-signature form wizard, PDF generation, email notifications to admins, and admin validation.
-   **IRS Proof Upload**: User profile integration with admin verification.
-   **Invoice Management**: Admin/agent upload of invoices, user-specific invoice display, and "Pay Now" functionality.
-   **Last Mile Integration**: Dedicated document categories and sub-categories, with automatic shipment creation from delivery orders.
-   **Fast ISF Filing**: Comprehensive 10+2 form with hybrid AI-powered document scanning (Azure + OpenAI), automatic ISF filing creation from uploaded documents with comprehensive field population (vessel, container, port, dates, SCAC codes, etc.), ISF editing workflow, and Stripe payment integration ($35.00 filing fee).
-   **XML Integration**: Support for external shipment database updates using XML (UN/EDIFACT, SMDG) with bidirectional data mapping.
-   **Chat/Support System**: Integrated customer support via Zendesk API for ticket management.
-   **Pagination**: Implemented for large data sets (e.g., shipments table) for improved performance.
-   **Branding**: Consistent Freightclear branding across the UI, including custom color schemes and professional design elements.

## External Dependencies

-   **Database Access**: `@neondatabase/serverless`
-   **ORM**: `drizzle-orm`
-   **Frontend State Management**: `@tanstack/react-query`
-   **Authentication**: `passport`, `openid-client`
-   **File Uploads**: `multer`, `react-dropzone`
-   **UI Primitives**: `@radix-ui/*`
-   **CSS Framework**: `tailwindcss`, `class-variance-authority`
-   **Icon Library**: `lucide-react`
-   **Payment Processing**: `accept-js` (Authorize.Net client-side), Authorize.Net API (backend)
-   **Document Processing**: OpenAI API (GPT-4o), Azure Document Intelligence
-   **PDF Generation**: `puppeteer` (for POA)
-   **Excel Parsing**: `xlsx` (for ISF document scanning)
-   **Customer Support**: Zendesk API