/* ═══════════════════════════════════════════════════════════════════
   ShellShockHive — Skill Acquisition Knowledge Base
   
   Deep expert-level knowledge profiles for languages, frameworks,
   and toolchains. Each profile contains idiomatic patterns, scaling
   strategies, AI-powered feature ideas, and anti-patterns.
   
   The agent analyzes a task, identifies needed skills, and injects
   relevant profiles into its system prompt for expert-level output.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Types ─── */

export interface SkillProfile {
        id: string;
        name: string;
        category: 'language' | 'framework' | 'database' | 'toolchain' | 'styling' | 'game-engine' | 'architecture' | 'security' | 'devops';
        /** Keywords that trigger this skill (matched against user prompt) */
        triggers: string[];
        /** Core idiomatic patterns and conventions */
        corePatterns: string;
        /** Production scaling patterns */
        scalingPatterns: string;
        /** AI-powered features unique to ShellShockHive */
        aiFeatures: string;
        /** Common mistakes and how to avoid them */
        antiPatterns: string;
        /** Key dependencies and their status */
        dependencies: string;
}

/* ═══════════════════════════════════════════
   SKILL PROFILES
   ═══════════════════════════════════════════ */

export const SKILL_PROFILES: SkillProfile[] = [

        /* ─── TypeScript ─── */
        {
                id: 'typescript',
                name: 'TypeScript',
                category: 'language',
                triggers: ['typescript', 'ts', '.tsx', '.ts', 'type', 'interface', 'enum', 'generic'],
                corePatterns: `
- Always use strict mode (strict: true in tsconfig)
- Prefer interfaces for object shapes, types for unions/intersections/mapped types
- Use const assertions for literal types: \`as const\`
- Leverage discriminated unions for state machines: \`type State = { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: Error }\`
- Use generic constraints: \`<T extends Record<string, unknown>>\`
- Prefer unknown over any — force explicit type narrowing
- Use satisfies operator for type-checked defaults: \`const config = { ... } satisfies Config\`
- Template literal types for string patterns: \`type Route = \`/api/\${string}\`\`
- Use branded types for IDs: \`type UserId = string & { __brand: 'UserId' }\`
- Barrel exports via index.ts for clean imports
- Zod for runtime validation + TypeScript type inference`,
                scalingPatterns: `
- Use project references for monorepo TypeScript
- Enable incremental builds with tsBuildInfo
- Use path aliases (@/ prefix) via tsconfig paths
- Separate types into a shared package for multi-service architectures
- Use declaration maps for debugging across packages`,
                aiFeatures: `
- Auto-generate Zod schemas from TypeScript interfaces
- Infer API response types from endpoint definitions
- Generate type-safe event emitters with discriminated unions
- Create exhaustive switch handlers with never type checking`,
                antiPatterns: `
- NEVER use any — use unknown and narrow
- NEVER use type assertions (as) to bypass errors — fix the types
- NEVER use non-null assertion (!) — use optional chaining or guards
- AVOID enums — use const objects with as const
- AVOID namespace — use ES modules
- NEVER export mutable variables`,
                dependencies: `
- zod: Runtime validation with type inference (RECOMMENDED)
- ts-pattern: Exhaustive pattern matching
- type-fest: Utility types collection
- tsx: TypeScript execution without compilation`,
        },

        /* ─── React ─── */
        {
                id: 'react',
                name: 'React',
                category: 'framework',
                triggers: ['react', 'component', 'hook', 'useState', 'useEffect', 'jsx', 'tsx', 'ui', 'frontend', 'webapp', 'web app', 'SPA', 'single page'],
                corePatterns: `
- Function components only — never class components
- Custom hooks for reusable logic: useLocalStorage, useDebounce, useMediaQuery
- Composition over prop drilling — use React.createContext + custom hook pattern
- Controlled components for forms — never uncontrolled refs for form state
- Use React.memo() only when profiler shows re-render bottleneck
- Keys must be stable IDs, never array indices for dynamic lists
- Error boundaries for graceful failure: class component with getDerivedStateFromError
- Lazy loading with React.lazy + Suspense for code splitting
- Use useCallback for event handlers passed to memoized children
- Use useMemo for expensive computations, not for simple values
- Prefer useReducer over complex useState for related state transitions
- Fragment shorthand <></> instead of unnecessary div wrappers`,
                scalingPatterns: `
- Component directory structure: ComponentName/index.tsx, ComponentName.module.css, ComponentName.test.tsx
- State management tiers: local state → context → Zustand/Jotai for global
- Virtual scrolling for large lists (react-window or @tanstack/virtual)
- Optimistic updates for mutations — update UI before server confirms
- React Query / TanStack Query for server state (caching, dedup, refetch)
- Code split by route with React.lazy, prefetch on hover
- Web Workers for CPU-heavy operations (parsing, sorting large datasets)`,
                aiFeatures: `
- Generate accessible components automatically (ARIA roles, keyboard nav, focus management)
- Smart form builder: infer validation from TypeScript types
- Auto-generate Storybook stories from component props
- Intelligent error boundary that logs, retries, and shows contextual recovery UI
- Auto-detect performance issues: unnecessary re-renders, missing keys, large bundles`,
                antiPatterns: `
- NEVER mutate state directly — always create new references
- NEVER put state that doesn't affect rendering into useState (use useRef)
- NEVER fetch data in useEffect without cleanup (race conditions)
- AVOID prop drilling more than 2 levels — use context or composition
- NEVER use index as key for lists that can reorder
- AVOID useEffect for derived state — compute during render
- NEVER update state in render — causes infinite loops`,
                dependencies: `
- @tanstack/react-query: Server state management (ESSENTIAL)
- zustand: Lightweight global state (preferred over Redux)
- react-hook-form + zod: Type-safe forms with validation
- framer-motion: Production animations
- @radix-ui/react-*: Accessible headless UI primitives
- lucide-react: Modern icon library`,
        },

        /* ─── Next.js ─── */
        {
                id: 'nextjs',
                name: 'Next.js',
                category: 'framework',
                triggers: ['nextjs', 'next.js', 'next', 'app router', 'server component', 'SSR', 'SSG', 'RSC', 'full-stack', 'fullstack'],
                corePatterns: `
- App Router (app/) is default — use Server Components by default, "use client" only when needed
- Server Components: fetch data directly in component, no useEffect needed
- Route Handlers: app/api/route-name/route.ts with GET/POST/PUT/DELETE exports
- Server Actions: "use server" functions for mutations (form submits, data writes)
- Metadata API: export metadata or generateMetadata for SEO
- Loading UI: loading.tsx for streaming Suspense boundaries
- Error handling: error.tsx for error boundaries per route segment
- Layouts: layout.tsx for shared UI that persists across navigations
- Use 'next/image' for optimized images (automatic WebP, lazy loading, sizing)
- Use 'next/link' for client-side navigation with prefetching
- Use 'next/font' for zero-layout-shift font loading
- Parallel routes (@folder) and intercepting routes ((..)folder) for modals
- Route groups (folder) for organization without affecting URL`,
                scalingPatterns: `
- ISR (Incremental Static Regeneration) for semi-static content
- Streaming with Suspense for progressive page loading
- Edge Runtime for low-latency API routes
- Middleware for auth, redirects, geolocation-based routing
- Static params generation for dynamic routes: generateStaticParams()
- Server-side caching: unstable_cache + revalidateTag for fine-grained invalidation
- Parallel data fetching: Promise.all() multiple fetch calls in Server Components
- Route segment config: export const dynamic / revalidate / runtime`,
                aiFeatures: `
- Auto-generate API route handlers with input validation (Zod) and error handling
- Smart SEO: auto-generate metadata, structured data, OG images
- Auto-detect N+1 queries in Server Components
- Generate optimized data fetching patterns: parallel vs waterfall detection
- AI-powered middleware for intelligent rate limiting and bot detection`,
                antiPatterns: `
- NEVER use "use client" unless you need browser APIs or interactivity
- NEVER fetch in useEffect in pages — use Server Components or Server Actions
- NEVER import server-only packages in client components
- AVOID large client bundles — keep "use client" boundary as low as possible
- NEVER store secrets in NEXT_PUBLIC_ env vars
- AVOID next/dynamic for everything — only for truly heavy components
- NEVER use getServerSideProps/getStaticProps in App Router (Pages Router only)`,
                dependencies: `
- next-auth / auth.js: Authentication (JWT + OAuth)
- next-safe-action: Type-safe server actions
- @t3-oss/env-nextjs: Environment variable validation
- next-intl: Internationalization for App Router
- sharp: Image optimization runtime (auto-installed by Next.js)`,
        },

        /* ─── Express / Node.js ─── */
        {
                id: 'express',
                name: 'Express / Node.js',
                category: 'framework',
                triggers: ['express', 'node', 'nodejs', 'api', 'server', 'backend', 'rest', 'RESTful', 'middleware', 'endpoint'],
                corePatterns: `
- Use express.json() and express.urlencoded() middleware
- Router-based architecture: separate route files per resource
- Controller pattern: route → controller → service → repository
- Async error handling: wrap all async handlers with catchAsync helper
- Use express-validator or Zod for input validation on every endpoint
- HTTP status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 500 Internal Server Error
- Use helmet() for security headers
- Use cors() with explicit origin whitelist
- Structured JSON error responses: { error: { code, message, details } }
- Environment-based config: dotenv + process.env validation at startup
- Graceful shutdown: handle SIGTERM, drain connections, close DB pools`,
                scalingPatterns: `
- Connection pooling for databases (pg Pool, mongoose connection reuse)
- Redis for caching hot paths (session, rate limit counters, query cache)
- Bull/BullMQ for background job queues
- Cluster mode or PM2 for multi-core utilization
- Rate limiting per IP and per API key: express-rate-limit + Redis store
- Request ID middleware for distributed tracing
- Health check endpoint: GET /health with DB connectivity check
- Pagination: cursor-based for large datasets, offset for admin panels
- Compression middleware for response bodies > 1KB`,
                aiFeatures: `
- Auto-generate OpenAPI/Swagger docs from route definitions
- Intelligent rate limiting that adapts to traffic patterns
- Auto-retry patterns for external API calls with exponential backoff
- Smart error classification: transient vs permanent, user vs system
- Generate comprehensive integration tests from route definitions`,
                antiPatterns: `
- NEVER use blocking synchronous operations (fs.readFileSync in request handlers)
- NEVER store state in memory across requests (use Redis/DB)
- NEVER catch errors silently — always log and respond
- NEVER trust client input — validate and sanitize everything
- NEVER expose stack traces in production errors
- AVOID deeply nested callbacks — use async/await
- NEVER commit .env files — use .env.example as template`,
                dependencies: `
- helmet: Security headers (ESSENTIAL)
- cors: CORS configuration
- express-rate-limit: Rate limiting
- zod: Input validation with TypeScript inference
- pino / winston: Structured logging
- dotenv: Environment variables
- uuid: Request ID generation`,
        },

        /* ─── Python / FastAPI ─── */
        {
                id: 'python',
                name: 'Python / FastAPI',
                category: 'framework',
                triggers: ['python', 'fastapi', 'flask', 'django', 'pip', 'py', 'pydantic', 'uvicorn'],
                corePatterns: `
- FastAPI for new projects (async, automatic OpenAPI docs, Pydantic validation)
- Pydantic models for all request/response schemas
- Type hints everywhere — use from typing import Optional, List, Dict
- Async endpoints with async def for I/O-bound operations
- Dependency injection via Depends() for DB sessions, auth, etc.
- Project structure: app/main.py, app/routers/, app/models/, app/schemas/, app/services/
- Use Path/Query/Body/Header for parameter documentation
- HTTPException for error responses with proper status codes
- Lifespan events for startup/shutdown (DB pool, background tasks)
- Use Enum for fixed choices, Literal for inline unions
- requirements.txt or pyproject.toml (poetry/uv) for dependency management`,
                scalingPatterns: `
- Connection pooling with SQLAlchemy async (asyncpg for Postgres)
- Background tasks with Celery + Redis or FastAPI BackgroundTasks
- Caching with Redis (aioredis for async)
- Gunicorn + Uvicorn workers for multi-process serving
- Alembic for database migrations
- Middleware for request timing, correlation IDs, CORS
- AsyncIO for concurrent external API calls`,
                aiFeatures: `
- Auto-generate API clients from FastAPI OpenAPI spec
- Generate comprehensive test suites with pytest + httpx
- Smart data validation with custom Pydantic validators
- Auto-detect SQL injection risks in raw queries
- Generate type-safe database models from existing schema`,
                antiPatterns: `
- NEVER use mutable default arguments (def foo(items=[]))
- NEVER use global mutable state for request handling
- NEVER catch bare except: — always catch specific exceptions
- AVOID synchronous DB calls in async endpoints (blocks event loop)
- NEVER hardcode secrets — use environment variables
- NEVER use eval() or exec() with user input`,
                dependencies: `
- fastapi: Modern async web framework
- uvicorn: ASGI server
- pydantic: Data validation
- sqlalchemy: Database ORM (supporting async)
- alembic: Database migrations
- httpx: Async HTTP client
- pytest + pytest-asyncio: Testing`,
        },

        /* ─── HTML / CSS ─── */
        {
                id: 'html-css',
                name: 'HTML / CSS',
                category: 'language',
                triggers: ['html', 'css', 'landing', 'page', 'website', 'static', 'responsive', 'layout', 'animation'],
                corePatterns: `
- Semantic HTML5: header, nav, main, section, article, aside, footer
- Single h1 per page, proper heading hierarchy (h1 → h2 → h3)
- Accessible forms: label + input association, fieldset/legend for groups
- ARIA roles only when semantic HTML is insufficient
- CSS Custom Properties (variables) for design tokens
- CSS Grid for 2D layouts, Flexbox for 1D alignment
- Mobile-first responsive design: min-width media queries
- Modern CSS: container queries, :has(), nesting, layers
- Use clamp() for fluid typography: font-size: clamp(1rem, 2.5vw, 2rem)
- Logical properties: margin-inline, padding-block for RTL support
- prefers-color-scheme for automatic dark mode
- prefers-reduced-motion for accessibility`,
                scalingPatterns: `
- BEM naming convention for component CSS
- CSS Modules or CSS-in-JS for scoped styles
- Critical CSS inline in <head>, defer non-critical
- Use will-change sparingly for animation performance hints
- Content-visibility: auto for off-screen content
- Asset optimization: WebP/AVIF images, WOFF2 fonts, SVG icons
- Lazy loading: loading="lazy" on images below the fold`,
                aiFeatures: `
- Auto-generate responsive layouts from design descriptions
- Accessibility audit: auto-detect missing alt text, contrast ratio issues, keyboard traps
- Smart color palette generation with WCAG contrast compliance
- Auto-generate CSS animations from natural language descriptions
- Performance optimization: detect layout thrashing, excessive repaints`,
                antiPatterns: `
- NEVER use inline styles for repeating patterns — use classes
- NEVER use !important — fix specificity instead
- NEVER use fixed sizes (px) for text — use rem/em
- AVOID float for layout — use Grid/Flexbox
- NEVER use tables for layout — only for tabular data
- AVOID deep selector nesting (>.3 levels) — increases specificity
- NEVER use ID selectors for styling — only for JS hooks`,
                dependencies: `
- Modern browsers support: CSS Grid, Custom Properties, @container, :has()
- PostCSS: For autoprefixer and future CSS features
- Open Props: Pre-built CSS custom properties
- Google Fonts: Inter, JetBrains Mono, Outfit (modern web fonts)`,
        },

        /* ─── Vite ─── */
        {
                id: 'vite',
                name: 'Vite',
                category: 'toolchain',
                triggers: ['vite', 'build tool', 'bundler', 'HMR', 'dev server'],
                corePatterns: `
- vite.config.ts for configuration (TypeScript config)
- Plugin system: @vitejs/plugin-react for React, vue for Vue
- Environment variables: VITE_ prefix for client-exposed vars
- Import aliases: resolve.alias in config for @ paths
- Static assets: public/ directory served at root
- CSS Modules: name.module.css auto-scoped
- import.meta.env for environment variables (not process.env)
- import.meta.glob for dynamic imports of multiple files`,
                scalingPatterns: `
- Manual chunks via build.rollupOptions.output.manualChunks for vendor splitting
- Dynamic import() for route-level code splitting
- Build analysis with rollup-plugin-visualizer
- Library mode for building packages: build.lib config
- SSR support with vite-plugin-ssr or framework integrations
- Pre-bundling optimization: optimizeDeps.include for large deps`,
                aiFeatures: `
- Auto-configure optimal chunk splitting based on import graph
- Generate vite.config.ts from project structure analysis
- Smart HMR boundary detection for faster dev experience`,
                antiPatterns: `
- NEVER use process.env in client code — use import.meta.env
- NEVER import Node.js built-ins in client code without polyfill config
- AVOID importing entire libraries — use named imports for tree shaking
- NEVER put secrets in VITE_ prefixed env vars`,
                dependencies: `
- @vitejs/plugin-react: React Fast Refresh
- vite-plugin-pwa: Progressive Web App support
- rollup-plugin-visualizer: Bundle analysis
- vite-tsconfig-paths: TypeScript path resolution`,
        },

        /* ─── PostgreSQL / Prisma ─── */
        {
                id: 'postgresql',
                name: 'PostgreSQL / Prisma',
                category: 'database',
                triggers: ['database', 'db', 'postgres', 'postgresql', 'sql', 'prisma', 'drizzle', 'orm', 'migration', 'schema', 'query'],
                corePatterns: `
- Prisma ORM for type-safe database access (recommended for TypeScript)
- Schema-first design: define models in schema.prisma
- Migrations: prisma migrate dev for development, prisma migrate deploy for production
- Use UUID for primary keys (cuid2 or ulid for sortable IDs)
- Always index columns used in WHERE, JOIN, and ORDER BY
- Use enums for fixed categories (status, role, type)
- Soft deletes: deletedAt timestamp instead of hard DELETE
- Timestamps: createdAt, updatedAt on every table
- Relations: use @relation for explicit foreign keys
- Transactions for multi-table operations: prisma.$transaction
- Connection pooling: use PgBouncer or Prisma Accelerate in production`,
                scalingPatterns: `
- Read replicas for query-heavy workloads
- Partitioning for tables > 100M rows (by date range typically)
- Materialized views for expensive aggregations
- pg_stat_statements for query performance monitoring
- EXPLAIN ANALYZE for query optimization
- Connection pooling: PgBouncer in transaction mode
- Database-level full-text search: tsvector + tsquery (cheaper than Elasticsearch)
- Row-level security (RLS) for multi-tenant isolation`,
                aiFeatures: `
- Auto-generate Prisma schema from natural language data model description
- Smart migration generation: detect breaking changes and suggest data transforms
- Query optimization: auto-detect N+1 queries and suggest includes/joins
- Auto-generate seed data that's realistic and consistent
- Type-safe query builder generation from schema analysis`,
                antiPatterns: `
- NEVER use sequential integer IDs exposed in URLs (info disclosure)
- NEVER store passwords in plaintext — use bcrypt/argon2
- NEVER use SELECT * in production queries — select explicit columns
- NEVER skip migrations in production — always version schema changes
- AVOID raw SQL unless Prisma query API is insufficient
- NEVER store JSON for relational data — normalize properly
- AVOID N+1 queries — use include/join, check with query logging`,
                dependencies: `
- prisma: Type-safe ORM (RECOMMENDED for TypeScript)
- drizzle-orm: Lightweight SQL-first alternative
- pg: Raw PostgreSQL client (when ORM is overkill)
- @prisma/client: Generated type-safe client
- prisma-dbml-generator: Generate ER diagrams from schema`,
        },

        /* ─── Docker ─── */
        {
                id: 'docker',
                name: 'Docker',
                category: 'toolchain',
                triggers: ['docker', 'container', 'dockerfile', 'compose', 'deploy', 'infrastructure', 'devops', 'CI/CD'],
                corePatterns: `
- Multi-stage builds to minimize image size
- Use official base images (node:22-slim, python:3.12-slim, etc.)
- Copy package.json first, install deps, then copy source (layer caching)
- Non-root user: RUN adduser and USER directive
- .dockerignore for node_modules, .git, .env, .next
- HEALTHCHECK instruction for container orchestrators
- docker-compose.yml for local multi-service development
- Environment variables via .env file and compose env_file
- Named volumes for persistent data (databases)
- Network aliases for service discovery within compose`,
                scalingPatterns: `
- Kubernetes / Docker Swarm for orchestration
- Multi-arch builds: docker buildx for ARM + x86
- Layer caching in CI: --cache-from and --cache-to
- Distroless or Alpine for minimal attack surface
- Resource limits: memory and CPU constraints in compose
- Rolling updates with health check grace periods`,
                aiFeatures: `
- Auto-generate optimized Dockerfiles from project analysis
- Generate docker-compose.yml with proper service dependencies
- Detect security issues: root user, exposed ports, missing health checks
- Auto-configure environment variables and secrets management`,
                antiPatterns: `
- NEVER run as root in containers
- NEVER store secrets in Dockerfile or image layers
- NEVER use latest tag in production — pin specific versions
- AVOID large base images — use slim/alpine variants
- NEVER expose unnecessary ports
- AVOID installing dev dependencies in production images`,
                dependencies: `
- docker compose v2: Multi-container orchestration
- hadolint: Dockerfile linter
- dive: Docker image layer analysis
- trivy: Container vulnerability scanning`,
        },

        /* ─── Godot Engine (GDScript) ─── */
        {
                id: 'godot',
                name: 'Godot Engine (GDScript)',
                category: 'game-engine',
                triggers: ['godot', 'game', 'rpg', 'platformer', '3d game', '2d game', 'gdscript', 'game engine', 'video game', 'quest', 'dialogue', 'inventory', 'npc', 'level', 'tilemap', 'sprite', 'fallout', 'skyrim', 'zelda'],
                corePatterns: `
- Scene tree architecture: everything is a Node in a tree hierarchy
- Use scenes as reusable prefabs — instantiate with .instantiate()
- Signals for decoupled communication: signal_name.emit() / signal_name.connect()
- GDScript: Python-like syntax. Use @export for inspector-editable vars
- Autoloads (singletons) for global state: GameManager, AudioManager, SaveSystem
- State machines for character/AI: Idle, Walk, Run, Attack, Hurt, Dead
- Node naming convention: PascalCase for scenes, snake_case for scripts
- Use @onready for node references: @onready var sprite = $Sprite2D
- Input mapping via InputMap: Input.is_action_pressed("move_left")
- Resource system: custom Resource classes for items, stats, dialogue data
- AnimationPlayer or AnimationTree for complex animation state machines
- TileMap for level design, NavigationRegion2D/3D for pathfinding`,
                scalingPatterns: `
- Object pooling for bullets/particles: pre-instantiate and recycle
- Chunk-based world loading for open-world games
- LOD (Level of Detail) for 3D models at distance
- Threading: use Thread for heavy computation (pathfinding, world gen)
- ECS-like patterns: split logic into composable components via child nodes
- Save system: Resource serialization to user:// directory
- Localization: TranslationServer with CSV/PO files
- Modular addons: res://addons/ for reusable plugins`,
                aiFeatures: `
- Auto-generate dialogue trees from narrative outlines
- Procedural level generation with constraint-based algorithms
- Smart NPC AI with behavior trees and utility AI scoring
- Auto-generate quest chains with branching narratives
- Dynamic difficulty adjustment based on player performance metrics
- Auto-generate item stats and loot tables with balance analysis`,
                antiPatterns: `
- NEVER use get_node with hardcoded paths in reusable scripts — use @export NodePath
- NEVER put game logic in _process without delta time — physics in _physics_process
- NEVER use strings for state tracking — use enums
- AVOID deep scene tree nesting — flatten with composition
- NEVER store references to freed nodes — use is_instance_valid()
- AVOID changing scenes with get_tree().change_scene — use SceneTree.change_scene_to_packed`,
                dependencies: `
- Godot 4.x: MIT licensed game engine (FREE, fully open-source)
- GDScript: Built-in scripting language (Python-like)
- Godot Asset Library: Free community addons/plugins
- Dialogic: Visual dialogue system addon (MIT)
- SmartShape2D: 2D terrain tool (MIT)`,
        },

        /* ─── Phaser / PixiJS ─── */
        {
                id: 'phaser',
                name: 'Phaser / PixiJS',
                category: 'game-engine',
                triggers: ['phaser', 'pixi', 'pixijs', '2d game', 'browser game', 'web game', 'arcade', 'html5 game', 'canvas game', 'sprite sheet', 'tile game'],
                corePatterns: `
- Phaser 3 scene lifecycle: preload → create → update
- Scene management: this.scene.start('NextScene', data)
- Physics: Arcade (simple), Matter.js (complex) — choose based on need
- Sprite sheets: load atlas, create animations from frames
- Input: this.input.keyboard.createCursorKeys() for arrow keys
- Tilemap: load from Tiled editor JSON exports
- Camera: this.cameras.main.startFollow(player)
- Groups for managing related objects: bullets, enemies, collectibles
- Events: this.events.emit/on for scene-internal communication
- Game config: type: Phaser.AUTO for WebGL with Canvas fallback
- Asset loading with LoadScene: show progress bar during preload`,
                scalingPatterns: `
- Object pooling with Phaser.GameObjects.Group.get()
- Scene parallelism: run HUD scene alongside gameplay scene
- Texture atlases: combine sprites into single draw calls
- Spatial hashing for collision optimization in large worlds
- WebGL shaders for post-processing effects
- Save state to localStorage: JSON.stringify game state`,
                aiFeatures: `
- Procedural map generation with cellular automata or wave function collapse
- Auto-generate enemy behavior patterns from difficulty curves
- Smart spawning systems with player skill-based difficulty
- Auto-generate sprite animations from sprite sheet detection`,
                antiPatterns: `
- NEVER create objects in update() — pre-create in create()
- NEVER load assets in create() — always in preload()
- AVOID unnecessary physics bodies — use overlap checks when possible
- NEVER manipulate DOM directly — use Phaser's rendering pipeline
- AVOID create() logic that depends on asset load order`,
                dependencies: `
- phaser: HTML5 game framework (MIT, FREE)
- @phaserjs/editor: Visual scene editor
- tiled: Free tile map editor (exports to Phaser JSON)
- aseprite / LibreSprite: Pixel art sprite editor (LibreSprite = free)`,
        },

        /* ─── Three.js / WebGL ─── */
        {
                id: 'threejs',
                name: 'Three.js / WebGL',
                category: 'game-engine',
                triggers: ['three.js', 'threejs', '3d', 'webgl', '3d web', 'webxr', 'shader', 'mesh', 'scene 3d', '3d graphics', 'three', 'glb', 'gltf', 'orbit controls'],
                corePatterns: `
- Scene → Camera → Renderer pipeline: always need all three
- Use THREE.WebGLRenderer with antialias, alpha, preserveDrawingBuffer
- PerspectiveCamera: FOV 75, aspect ratio, near 0.1, far 1000
- Geometry + Material = Mesh: add to scene
- Animation loop: renderer.setAnimationLoop(animate)
- GLTF/GLB for 3D models: use GLTFLoader with draco compression
- Lighting: AmbientLight (base) + DirectionalLight (sun) + PointLight (local)
- OrbitControls for camera interaction
- Raycaster for mouse/touch picking
- Use BufferGeometry (not Geometry) for performance
- Dispose resources: geometry.dispose(), material.dispose(), texture.dispose()`,
                scalingPatterns: `
- Instanced rendering (InstancedMesh) for many identical objects
- LOD (Level of Detail): THREE.LOD with distance-based meshes
- Frustum culling: automatic, ensure bounding boxes are correct
- Texture atlases for reducing draw calls
- Web Workers for physics / heavy computation
- Post-processing with EffectComposer: bloom, SSAO, FXAA
- Octree for spatial queries and collision detection`,
                aiFeatures: `
- Procedural environment generation from text descriptions
- Auto-generate shader materials from visual descriptions
- Smart camera paths and cinematic sequences
- Dynamic lighting that adapts to scene mood/time of day
- Auto-optimize geometry complexity based on device performance`,
                antiPatterns: `
- NEVER create objects inside animation loop — pre-create and modify
- NEVER forget to dispose resources — causes memory leaks
- AVOID synchronous model loading — always use async loaders
- NEVER use MeshBasicMaterial for lit scenes — use MeshStandardMaterial
- AVOID high polygon counts without LOD for mobile targets`,
                dependencies: `
- three: 3D graphics library (MIT, FREE)
- @react-three/fiber: React renderer for Three.js
- @react-three/drei: Useful helpers and abstractions
- cannon-es: Physics engine (free)
- leva: GUI controls for debugging (free)`,
        },

        /* ─── Microservices Architecture ─── */
        {
                id: 'microservices',
                name: 'Microservices Architecture',
                category: 'architecture',
                triggers: ['microservice', 'platform', 'amazon', 'scale', 'enterprise', 'distributed', 'service mesh', 'event driven', 'message queue', 'monolith', 'api gateway', 'multi-service', 'saas'],
                corePatterns: `
- Service boundaries: one service per bounded context (users, orders, payments)
- API Gateway pattern: single entry point, routes to internal services
- Service-to-service: REST for synchronous, RabbitMQ/NATS for async events
- Each service owns its database — no shared databases
- Event sourcing for critical business data: append-only event log
- CQRS: separate read and write models for query-heavy services
- Circuit breaker for external dependencies: opossum or custom
- Idempotency keys for retry-safe operations (payments, emails)
- Health check on every service: /health, /ready, /live
- Correlation IDs: propagate request ID across all services
- 12-Factor App: config from env, stateless processes, log to stdout`,
                scalingPatterns: `
- Horizontal scaling: stateless services behind load balancer
- Database sharding: partition by tenant_id or region
- CQRS + event sourcing for write-heavy workloads
- Edge caching: CDN for static, Redis for API responses
- Rate limiting at gateway level: token bucket algorithm
- Saga pattern for distributed transactions (orchestration vs choreography)
- Bulkhead pattern: isolate critical services from cascading failures
- Feature flags for progressive rollouts: LaunchDarkly or Unleash (free)`,
                aiFeatures: `
- Auto-generate service boundaries from domain model analysis
- Smart API gateway routing with adaptive load balancing
- Auto-detect circular dependencies between services
- Generate comprehensive integration test suites
- Intelligent circuit breaker thresholds from traffic patterns`,
                antiPatterns: `
- NEVER share databases between services — each owns its data
- NEVER use synchronous calls for non-critical operations — use events
- NEVER deploy all services together — independent deployment is the point
- AVOID distributed transactions — use sagas or eventual consistency
- NEVER ignore idempotency for financial operations
- AVOID chatty services — aggregate data before sending`,
                dependencies: `
- RabbitMQ: Message broker (MPL 2.0, FREE)
- NATS: High-performance messaging (Apache 2.0, FREE)
- Traefik: Reverse proxy / API gateway (MIT, FREE)
- Jaeger: Distributed tracing (Apache 2.0, FREE)
- Unleash: Feature flags (Apache 2.0, FREE)`,
        },

        /* ─── Redis / Caching ─── */
        {
                id: 'redis',
                name: 'Redis / Caching',
                category: 'database',
                triggers: ['redis', 'cache', 'caching', 'session', 'queue', 'pub/sub', 'rate limit', 'real-time', 'websocket', 'leaderboard'],
                corePatterns: `
- Use ioredis (Node.js) or redis-py (Python) — typed and well-maintained
- Key naming convention: service:entity:id (e.g., user:session:abc123)
- TTL on every key — never store without expiration unless intentional
- Use MULTI/EXEC for atomic operations
- Hash type for object-like data: HSET/HGET user:123 name "Alice"
- Sorted sets for leaderboards: ZADD/ZRANGE with scores
- Pub/Sub for real-time notifications between services
- Streams for event-log style message queues
- SET NX for distributed locks (with TTL for safety)`,
                scalingPatterns: `
- Redis Cluster for horizontal scaling (16384 hash slots)
- Redis Sentinel for high availability (automatic failover)
- Pipeline commands for batch operations (reduce round trips)
- Lua scripts for complex atomic operations
- Memory optimization: use hashes for small objects (ziplist encoding)
- Eviction policies: allkeys-lfu for cache, noeviction for queue`,
                aiFeatures: `
- Auto-detect cache candidates from database query patterns
- Smart TTL tuning based on access frequency analysis
- Cache warming strategies for predictable traffic patterns
- Auto-generate Redis data models from application state analysis`,
                antiPatterns: `
- NEVER use Redis as primary database — it's a cache/queue
- NEVER store large blobs (>1MB) — use object storage
- NEVER use KEYS command in production — use SCAN
- AVOID storing sensitive data without encryption
- NEVER assume Redis data survives restarts without persistence config`,
                dependencies: `
- Redis / Valkey: In-memory data store (BSD, FREE)
- ioredis: Node.js Redis client (MIT)
- BullMQ: Job queue built on Redis (MIT)
- Redis Insight: GUI for Redis (free tier)`,
        },

        /* ─── GraphQL / tRPC ─── */
        {
                id: 'graphql',
                name: 'GraphQL / tRPC',
                category: 'framework',
                triggers: ['graphql', 'trpc', 'api gateway', 'apollo', 'schema', 'query language', 'mutation', 'subscription', 'type safe api', 'typesafe api'],
                corePatterns: `
- GraphQL: schema-first or code-first with type-graphql/pothos
- tRPC: end-to-end typesafe APIs without code generation (TypeScript only)
- Resolvers: Query (read), Mutation (write), Subscription (real-time)
- DataLoader for N+1 prevention: batch + cache per-request
- Input validation at resolver level: use Zod or class-validator
- Pagination: cursor-based for infinite scroll, offset for pages
- Error handling: custom error codes with extensions
- Auth: context-based — extract user from JWT in context
- Fragment colocation: keep fragments near components that use them`,
                scalingPatterns: `
- Persisted queries: whitelist known queries, block arbitrary ones
- Query complexity analysis: limit nested depth and field count
- Federated schemas: Apollo Federation for multi-team services
- Automatic query batching: combine multiple queries into one request
- CDN caching with cache-control directives
- tRPC: use superjson for rich type serialization`,
                aiFeatures: `
- Auto-generate GraphQL schema from database model
- Generate type-safe client SDK from schema
- Smart query optimization: detect and merge overlapping queries
- Auto-generate mock resolvers from schema for testing`,
                antiPatterns: `
- NEVER expose all database fields directly — create separate schema types
- NEVER allow unbounded queries — always limit depth and complexity
- AVOID returning full objects for lists — use connection pattern
- NEVER skip input validation — GraphQL schema validation is not enough
- AVOID mixing tRPC and GraphQL in the same project — choose one`,
                dependencies: `
- @apollo/server: GraphQL server (MIT, FREE)
- @trpc/server + @trpc/client: End-to-end typesafe APIs (MIT, FREE)
- pothos: Code-first GraphQL schema builder (MIT)
- graphql-codegen: Generate TypeScript types from schema (MIT)
- urql: Lightweight GraphQL client (MIT)`,
        },

        /* ─── Auth / Security ─── */
        {
                id: 'auth',
                name: 'Authentication & Security',
                category: 'security',
                triggers: ['auth', 'login', 'signup', 'register', 'oauth', 'jwt', 'session', 'password', 'rbac', 'permission', 'token', 'two-factor', '2fa', 'sso', 'security', 'authorization', 'user account'],
                corePatterns: `
- Passwords: bcrypt (cost 12) or argon2id — NEVER plaintext or MD5/SHA
- JWT: short-lived access tokens (15min) + long-lived refresh tokens (7d)
- Store refresh tokens in httpOnly, secure, sameSite cookies — NEVER localStorage
- OAuth 2.0 / OIDC for social login: authorization code flow with PKCE
- RBAC: Role-Based Access Control with permission hierarchy
- Middleware-level auth: verify token on every protected route
- Rate limit login attempts: max 5 per IP per 15 minutes
- CSRF protection: SameSite cookies or anti-CSRF tokens
- Input sanitization: prevent XSS, SQL injection on all user input
- Use HTTPS everywhere — redirect HTTP to HTTPS
- Security headers: CSP, X-Frame-Options, X-Content-Type-Options`,
                scalingPatterns: `
- Centralized auth service: separate from application services
- Token blacklist: Redis SET for revoked tokens with TTL
- Session clustering: Redis-backed sessions for horizontal scaling
- OAuth provider: Keycloak (self-hosted, open-source) for enterprise SSO
- API key management: separate from user auth, rate limit per key
- Audit logging: log all auth events (login, logout, permission change)`,
                aiFeatures: `
- Auto-generate auth middleware with proper error responses
- Smart permission matrix generation from route definitions
- Auto-detect security vulnerabilities in auth flow
- Generate comprehensive auth test suites (edge cases, attack vectors)`,
                antiPatterns: `
- NEVER store passwords in plaintext or reversible encryption
- NEVER put JWTs in localStorage — vulnerable to XSS
- NEVER log sensitive data: passwords, tokens, API keys
- NEVER trust client-side authorization checks — always verify server-side
- NEVER use symmetric JWT signing in multi-service — use RS256
- AVOID rolling your own crypto — use established libraries`,
                dependencies: `
- Keycloak: Identity management (Apache 2.0, FREE)
- next-auth / auth.js: NextJS authentication (ISC, FREE)
- passport: Express authentication middleware (MIT, FREE)
- bcrypt / argon2: Password hashing (MIT)
- jose: JWT implementation (MIT)
- helmet: Security headers (MIT)`,
        },

        /* ─── CI/CD / DevOps ─── */
        {
                id: 'cicd',
                name: 'CI/CD & DevOps',
                category: 'devops',
                triggers: ['ci', 'cd', 'ci/cd', 'github actions', 'pipeline', 'deploy', 'deployment', 'staging', 'production', 'release', 'workflow', 'automation', 'terraform', 'ansible', 'monitoring'],
                corePatterns: `
- GitHub Actions: .github/workflows/*.yml for CI/CD
- Pipeline stages: lint → test → build → deploy
- Environment separation: dev → staging → production
- Secrets in GitHub Secrets / environment variables — never in code
- Cache dependencies: actions/cache for node_modules, pip cache
- Matrix builds: test against multiple Node/Python versions
- Artifact uploads: save build outputs for downstream jobs
- Branch protection: require PR reviews + passing CI for main
- Semantic versioning: major.minor.patch with conventional commits`,
                scalingPatterns: `
- Monorepo CI: only build/test changed packages (nx affected, turbo)
- Docker layer caching in CI for faster builds
- Blue-green deployment: zero-downtime with health check cutover
- Canary releases: gradual rollout with automatic rollback on errors
- Infrastructure as Code: Terraform or Pulumi for reproducible infrastructure
- GitOps: Argo CD or Flux for Kubernetes deployments`,
                aiFeatures: `
- Auto-generate GitHub Actions workflows from project analysis
- Smart test selection: only run tests affected by changed files
- Auto-generate deployment scripts from Docker/compose configuration
- Intelligent rollback triggers based on error rate thresholds`,
                antiPatterns: `
- NEVER deploy without running tests first
- NEVER hardcode secrets in CI config — use secret management
- NEVER skip staging — always test in production-like environment
- AVOID manual deployment steps — automate everything
- NEVER ignore failing tests — fix or remove them
- AVOID deploying on Fridays (seriously)`,
                dependencies: `
- GitHub Actions: CI/CD platform (FREE for public repos)
- Docker: Containerization (Apache 2.0, FREE)
- Terraform: Infrastructure as Code (MPL 2.0, FREE)
- Prometheus + Grafana: Monitoring and dashboards (Apache 2.0, FREE)
- Argo CD: GitOps for Kubernetes (Apache 2.0, FREE)`,
        },
];

/* ═══════════════════════════════════════════
   SKILL MATCHING ENGINE
   ═══════════════════════════════════════════ */

/**
 * Analyze a user prompt and return relevant skill profiles.
 * Matches against trigger keywords with fuzzy/case-insensitive matching.
 */
export function identifySkills(prompt: string): SkillProfile[] {
        const lower = prompt.toLowerCase();
        const matched: SkillProfile[] = [];

        for (const skill of SKILL_PROFILES) {
                const score = skill.triggers.reduce((acc, trigger) => {
                        return acc + (lower.includes(trigger.toLowerCase()) ? 1 : 0);
                }, 0);

                if (score > 0) {
                        matched.push(skill);
                }
        }

        // Always include TypeScript for any web project
        if (matched.some(s => ['react', 'nextjs', 'vite', 'phaser', 'threejs', 'graphql'].includes(s.id)) &&
                !matched.some(s => s.id === 'typescript')) {
                const ts = SKILL_PROFILES.find(s => s.id === 'typescript');
                if (ts) matched.push(ts);
        }

        // Always include HTML/CSS for frontend projects
        if (matched.some(s => ['react', 'nextjs'].includes(s.id)) &&
                !matched.some(s => s.id === 'html-css')) {
                const htmlCss = SKILL_PROFILES.find(s => s.id === 'html-css');
                if (htmlCss) matched.push(htmlCss);
        }

        // Auto-include Docker for microservices
        if (matched.some(s => s.id === 'microservices') &&
                !matched.some(s => s.id === 'docker')) {
                const docker = SKILL_PROFILES.find(s => s.id === 'docker');
                if (docker) matched.push(docker);
        }

        // Auto-include Redis for platform/microservice projects
        if (matched.some(s => ['microservices', 'express'].includes(s.id)) &&
                !matched.some(s => s.id === 'redis')) {
                const redis = SKILL_PROFILES.find(s => s.id === 'redis');
                if (redis) matched.push(redis);
        }

        // Auto-include Auth for user-facing applications
        if (matched.some(s => ['nextjs', 'express', 'microservices'].includes(s.id)) &&
                (lower.includes('user') || lower.includes('login') || lower.includes('account') || lower.includes('platform')) &&
                !matched.some(s => s.id === 'auth')) {
                const auth = SKILL_PROFILES.find(s => s.id === 'auth');
                if (auth) matched.push(auth);
        }

        // If no specific match, provide general web defaults
        if (matched.length === 0) {
                const defaults = ['typescript', 'react', 'html-css'];
                for (const id of defaults) {
                        const skill = SKILL_PROFILES.find(s => s.id === id);
                        if (skill) matched.push(skill);
                }
        }

        return matched;
}

/**
 * Build a condensed knowledge injection string from matched skills.
 * This gets injected into the system prompt for expert-level output.
 */
export function buildSkillContext(skills: SkillProfile[]): string {
        if (skills.length === 0) return '';

        const sections = skills.map(skill => {
                return `### ${skill.name} Expert Knowledge

**Patterns & Conventions:**
${skill.corePatterns}

**Scaling for Production:**
${skill.scalingPatterns}

**AI-Powered Features (unique to ShellShockHive):**
${skill.aiFeatures}

**Critical Anti-Patterns (NEVER do these):**
${skill.antiPatterns}

**Key Dependencies:**
${skill.dependencies}`;
        });

        return `
## 🧠 EXPERT SKILL KNOWLEDGE

You have deep expertise in the following technologies. Use this knowledge to write production-grade, scalable code that follows established best practices. Prioritize the AI-powered features section — these are unique capabilities that differentiate ShellShockHive from other coding agents.

${sections.join('\n\n---\n\n')}

## Expert-Level Rules
- ALWAYS follow the patterns described above for each technology
- NEVER violate the anti-patterns listed — these are hard rules
- When building new features, ALWAYS suggest at least one AI-powered enhancement from the list above
- If a recommended dependency would help, mention it in your plan
- Write code that a senior engineer would approve in code review
`;
}
