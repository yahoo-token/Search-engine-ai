# Overview

YAS (YHT AI Search Engine) is a modern web application that combines intelligent search functionality with AI-powered responses and a cryptocurrency token reward system. The platform allows users to search through crawled web content and receive AI-generated summaries and insights, while earning YHT tokens for quality searches. Built as a full-stack TypeScript application with React frontend and Express backend.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: TanStack Query for server state and React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Framework**: Express.js with TypeScript in ESM module format
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **API Design**: RESTful endpoints with JSON responses
- **Error Handling**: Centralized error middleware with structured responses

## Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Connection**: Neon serverless PostgreSQL with connection pooling
- **Schema**: Strongly typed with Zod validation schemas
- **Migrations**: Drizzle Kit for schema management

## Core Data Models
- **Users**: Authentication with username/password, YHT token balances, wallet integration
- **Search Queries**: User search history with AI responses and token rewards
- **Crawled Sites**: Web content storage with categorization and ranking
- **Token Transactions**: Blockchain-style transaction logging for YHT rewards

## AI Integration
- **Provider**: OpenAI GPT-4o for intelligent search responses
- **Features**: Query categorization, content summarization, related questions generation
- **Context Processing**: Limited to top 5 search results for optimal response quality

## Web Crawling System
- **Architecture**: Custom crawler with URL queue management
- **Content Processing**: HTML parsing for title, description, and content extraction
- **Categorization**: AI-powered automatic content categorization
- **Rate Limiting**: Built-in crawl throttling and duplicate URL prevention

## Security & Performance
- **Session Security**: Secure cookie configuration with HTTP-only flags
- **Password Hashing**: Scrypt-based password hashing with salt
- **Type Safety**: End-to-end TypeScript with shared schema definitions
- **Development**: Hot reload with Vite integration and error overlay

## Token Economics
- **Reward System**: Users earn YHT tokens for quality searches (base 5 tokens)
- **Transaction Tracking**: Full audit trail of token earnings and usage
- **Future Integration**: Wallet address storage for potential blockchain integration

# External Dependencies

## Database & Infrastructure
- **Neon PostgreSQL**: Serverless PostgreSQL database with WebSocket support
- **Session Store**: PostgreSQL-backed session storage for authentication persistence

## AI & Machine Learning
- **OpenAI API**: GPT-4o model for intelligent search responses and content categorization
- **Natural Language Processing**: Query understanding and content summarization

## Frontend Libraries
- **Radix UI**: Comprehensive component primitives for accessibility
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form validation and submission handling

## Development Tools
- **Vite**: Fast development server and build tool
- **Drizzle Kit**: Database schema management and migrations
- **TypeScript**: Type safety across the entire application stack
- **ESBuild**: Fast JavaScript bundling for production builds

## Authentication & Security
- **Passport.js**: Authentication middleware with local strategy
- **Express Session**: Session management with PostgreSQL backing
- **Crypto Module**: Native Node.js cryptography for password hashing