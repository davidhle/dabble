# Dabble

A modern React TypeScript application built with Vite, featuring D3.js data visualization, Tailwind CSS styling, and React Router navigation.

## Tech Stack

### Core

- **React 18** - UI library with hooks and concurrent features
- **TypeScript** - Type-safe JavaScript for better developer experience and code quality
- **Vite** - Next-generation build tool with lightning-fast HMR (Hot Module Replacement)

### Styling

- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **PostCSS** - CSS transformation tool (used with Tailwind)
- **Autoprefixer** - Automatic vendor prefixing for CSS

### Data Visualization

- **D3.js** - Powerful library for creating dynamic, interactive data visualizations
- **@types/d3** - TypeScript type definitions for D3

### Routing

- **React Router DOM** - Declarative routing for React applications

### Code Quality

- **ESLint** - JavaScript/TypeScript linter for identifying code issues
- **Prettier** - Opinionated code formatter for consistent style
- **eslint-plugin-prettier** - Runs Prettier as an ESLint rule
- **eslint-config-prettier** - Disables ESLint rules that conflict with Prettier

## Project Structure

```
dabble/
├── public/                 # Static assets served as-is
│   └── vite.svg
├── src/
│   ├── assets/            # Asset files (images, fonts, etc.)
│   │   └── react.svg
│   ├── components/        # Reusable UI components
│   │   ├── D3Chart.tsx    # D3.js bar chart component
│   │   └── Layout.tsx     # Main layout with navigation
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page components (route targets)
│   │   ├── About.tsx      # About page
│   │   ├── Chart.tsx      # D3 chart demo page
│   │   └── Home.tsx       # Home page
│   ├── App.tsx            # Root component with routing
│   ├── index.css          # Global styles with Tailwind
│   ├── main.tsx           # Application entry point
│   └── vite-env.d.ts      # Vite type declarations
├── .eslintrc.cjs          # ESLint configuration
├── .prettierrc            # Prettier configuration
├── .prettierignore        # Files ignored by Prettier
├── index.html             # HTML entry point
├── package.json           # Dependencies and scripts
├── postcss.config.js      # PostCSS configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
├── tsconfig.node.json     # TypeScript config for Node
└── vite.config.ts         # Vite configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint to check for issues |
| `npm run lint:fix` | Run ESLint and auto-fix issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check if code is formatted |
| `npm run type-check` | Run TypeScript type checking |

## Tech Stack Choices Explained

### Why Vite?

- **Speed**: Vite uses native ES modules for instant server start and lightning-fast HMR
- **Modern**: Built for modern browsers with optimized production builds using Rollup
- **Simple**: Zero-config for most use cases, easy to extend when needed
- **TypeScript**: First-class TypeScript support out of the box

### Why Tailwind CSS?

- **Rapid Development**: Utility classes eliminate context switching between HTML and CSS
- **Consistency**: Design system constraints prevent inconsistent styling
- **Performance**: Automatic purging removes unused CSS in production
- **Customizable**: Easy to extend with custom design tokens

### Why D3.js?

- **Flexibility**: Complete control over visualizations, not limited to pre-built chart types
- **Power**: Handles complex data transformations and animations
- **SVG-based**: Creates scalable, accessible visualizations
- **React Integration**: Works well with React's ref system for DOM manipulation

### Why React Router?

- **Declarative**: Routes defined as components, fitting React's mental model
- **Nested Routes**: Support for complex layouts with shared UI elements
- **Data Loading**: Built-in data fetching patterns (v6+)
- **Standard**: The most widely-used routing solution in the React ecosystem

### Why ESLint + Prettier?

- **Separation of Concerns**: ESLint handles code quality, Prettier handles formatting
- **Consistency**: Automated formatting ensures consistent code style across the team
- **IDE Integration**: Real-time feedback in editors for immediate issue detection
- **CI-Friendly**: Easy to integrate into CI/CD pipelines

## Features

- **Responsive Navigation**: Mobile-friendly navigation layout
- **Interactive Charts**: D3.js bar chart with animations and data randomization
- **Type Safety**: Full TypeScript coverage for components and D3 interactions
- **Code Quality**: Pre-configured linting and formatting

## Adding New Features

### Adding a New Page

1. Create a new component in `src/pages/`
2. Add a route in `src/App.tsx`
3. Add a navigation link in `src/components/Layout.tsx`

### Adding a New D3 Visualization

1. Create a component in `src/components/`
2. Use `useRef` to get a reference to the SVG element
3. Use `useEffect` to run D3 code when data changes
4. Clear previous content with `selectAll('*').remove()` before redrawing

## License

MIT
