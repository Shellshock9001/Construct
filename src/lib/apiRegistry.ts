/* ═══════════════════════════════════════════════════════════════════
   Construct — Public API Registry

   Curated knowledge base of free/public APIs the agent uses at
   blueprint decomposition time. When the agent sees "build a weather
   app," it looks up 'weather' and gets real endpoints, auth methods,
   and free tier details — no user configuration needed.

   NOT a settings page. These are free APIs. Built into the codebase.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Types ─── */

export interface APIEntry {
    name: string;
    url: string;
    docsUrl: string;
    category: APICategory;
    auth: 'none' | 'apiKey' | 'oauth';
    freeTier: boolean;
    description: string;
    exampleEndpoint: string;
    rateLimit?: string;
    dataFormat: 'json' | 'xml' | 'graphql';
    cors: boolean;
}

export type APICategory =
    | 'weather'
    | 'finance'
    | 'games'
    | 'maps'
    | 'auth'
    | 'media'
    | 'social'
    | 'data_test'
    | 'ml_ai'
    | 'communication'
    | 'development'
    | 'ecommerce'
    | 'health'
    | 'news'
    | 'sports';

/* ═══════════════════════════════════════════
   CURATED REGISTRY
   ~5-8 best free APIs per category.
   Focus: actually useful for building apps.
   ═══════════════════════════════════════════ */

const REGISTRY: APIEntry[] = [
    // ── Weather ──
    {
        name: 'Open-Meteo',
        url: 'https://api.open-meteo.com/v1/forecast',
        docsUrl: 'https://open-meteo.com/en/docs',
        category: 'weather',
        auth: 'none',
        freeTier: true,
        description: 'Free weather API with hourly/daily forecasts, no API key needed. Best for prototypes.',
        exampleEndpoint: 'GET https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true',
        rateLimit: '10000/day',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'OpenWeatherMap',
        url: 'https://api.openweathermap.org/data/2.5',
        docsUrl: 'https://openweathermap.org/api',
        category: 'weather',
        auth: 'apiKey',
        freeTier: true,
        description: 'Most popular weather API. Current weather, 5-day forecast, geocoding. Free tier: 1000 calls/day.',
        exampleEndpoint: 'GET /weather?q=London&appid={API_KEY}&units=metric',
        rateLimit: '1000/day',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'WeatherAPI',
        url: 'https://api.weatherapi.com/v1',
        docsUrl: 'https://www.weatherapi.com/docs/',
        category: 'weather',
        auth: 'apiKey',
        freeTier: true,
        description: 'Weather + astronomy + timezone. Free tier: 1M calls/month.',
        exampleEndpoint: 'GET /current.json?key={API_KEY}&q=London',
        rateLimit: '1000000/month',
        dataFormat: 'json',
        cors: true,
    },

    // ── Finance ──
    {
        name: 'Alpha Vantage',
        url: 'https://www.alphavantage.co/query',
        docsUrl: 'https://www.alphavantage.co/documentation/',
        category: 'finance',
        auth: 'apiKey',
        freeTier: true,
        description: 'Stock market data: prices, technical indicators, fundamentals. Free tier: 25 requests/day.',
        exampleEndpoint: 'GET ?function=TIME_SERIES_DAILY&symbol=IBM&apikey={API_KEY}',
        rateLimit: '25/day',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'CoinGecko',
        url: 'https://api.coingecko.com/api/v3',
        docsUrl: 'https://www.coingecko.com/en/api/documentation',
        category: 'finance',
        auth: 'none',
        freeTier: true,
        description: 'Cryptocurrency data: prices, market cap, exchanges, trending. No key needed.',
        exampleEndpoint: 'GET /simple/price?ids=bitcoin,ethereum&vs_currencies=usd',
        rateLimit: '10-30/minute',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'Finnhub',
        url: 'https://finnhub.io/api/v1',
        docsUrl: 'https://finnhub.io/docs/api',
        category: 'finance',
        auth: 'apiKey',
        freeTier: true,
        description: 'Real-time stock data, company news, earnings, recommendations. Free tier: 60 calls/minute.',
        exampleEndpoint: 'GET /quote?symbol=AAPL&token={API_KEY}',
        rateLimit: '60/minute',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'ExchangeRate-API',
        url: 'https://open.er-api.com/v6/latest',
        docsUrl: 'https://www.exchangerate-api.com/docs/free',
        category: 'finance',
        auth: 'none',
        freeTier: true,
        description: 'Currency exchange rates. No key needed for basic usage.',
        exampleEndpoint: 'GET /USD',
        rateLimit: '1500/month',
        dataFormat: 'json',
        cors: true,
    },

    // ── Games ──
    {
        name: 'PokéAPI',
        url: 'https://pokeapi.co/api/v2',
        docsUrl: 'https://pokeapi.co/docs/v2',
        category: 'games',
        auth: 'none',
        freeTier: true,
        description: 'Complete Pokémon data: species, moves, abilities, types, items, berries, locations. RESTful, no key.',
        exampleEndpoint: 'GET /pokemon/pikachu — returns stats, types, abilities, sprites',
        rateLimit: '100/minute (cached heavily)',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'RAWG',
        url: 'https://api.rawg.io/api',
        docsUrl: 'https://rawg.io/apidocs',
        category: 'games',
        auth: 'apiKey',
        freeTier: true,
        description: 'Video game database: 500k+ games. Ratings, screenshots, stores, platforms.',
        exampleEndpoint: 'GET /games?key={API_KEY}&search=portal',
        rateLimit: '20000/month',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'D&D 5e API',
        url: 'https://www.dnd5eapi.co/api',
        docsUrl: 'https://www.dnd5eapi.co/docs/',
        category: 'games',
        auth: 'none',
        freeTier: true,
        description: 'Complete D&D 5th Edition SRD data: classes, spells, monsters, equipment.',
        exampleEndpoint: 'GET /spells/fireball',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'Chess.com Public API',
        url: 'https://api.chess.com/pub',
        docsUrl: 'https://www.chess.com/news/view/published-data-api',
        category: 'games',
        auth: 'none',
        freeTier: true,
        description: 'Chess.com player profiles, stats, games, leaderboards.',
        exampleEndpoint: 'GET /player/hikaru/stats',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'Open Trivia DB',
        url: 'https://opentdb.com/api.php',
        docsUrl: 'https://opentdb.com/api_config.php',
        category: 'games',
        auth: 'none',
        freeTier: true,
        description: 'Trivia questions across 24 categories. Great for quiz apps.',
        exampleEndpoint: 'GET ?amount=10&category=9&type=multiple',
        dataFormat: 'json',
        cors: true,
    },

    // ── Maps & Geocoding ──
    {
        name: 'OpenStreetMap Nominatim',
        url: 'https://nominatim.openstreetmap.org',
        docsUrl: 'https://nominatim.org/release-docs/develop/',
        category: 'maps',
        auth: 'none',
        freeTier: true,
        description: 'Free geocoding: address → coordinates and reverse. Requires User-Agent header.',
        exampleEndpoint: 'GET /search?q=London&format=json',
        rateLimit: '1/second',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'IP Geolocation (ipapi)',
        url: 'https://ipapi.co',
        docsUrl: 'https://ipapi.co/api/',
        category: 'maps',
        auth: 'none',
        freeTier: true,
        description: 'IP → location, timezone, currency, ISP. No key needed for basic use.',
        exampleEndpoint: 'GET /json/ — returns location of requester',
        rateLimit: '1000/day',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'RestCountries',
        url: 'https://restcountries.com/v3.1',
        docsUrl: 'https://restcountries.com/',
        category: 'maps',
        auth: 'none',
        freeTier: true,
        description: 'Country data: flags, population, languages, currencies, borders.',
        exampleEndpoint: 'GET /name/germany',
        dataFormat: 'json',
        cors: true,
    },

    // ── Media ──
    {
        name: 'Unsplash',
        url: 'https://api.unsplash.com',
        docsUrl: 'https://unsplash.com/documentation',
        category: 'media',
        auth: 'apiKey',
        freeTier: true,
        description: 'High-quality free photos. 50 requests/hour. Attribution required.',
        exampleEndpoint: 'GET /photos/random?query=nature',
        rateLimit: '50/hour',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'TMDB (The Movie Database)',
        url: 'https://api.themoviedb.org/3',
        docsUrl: 'https://developers.themoviedb.org/3',
        category: 'media',
        auth: 'apiKey',
        freeTier: true,
        description: 'Movies, TV shows, actors. Ratings, posters, trailers. Huge dataset.',
        exampleEndpoint: 'GET /movie/popular?api_key={API_KEY}',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'Lorem Picsum',
        url: 'https://picsum.photos',
        docsUrl: 'https://picsum.photos/',
        category: 'media',
        auth: 'none',
        freeTier: true,
        description: 'Random placeholder images. No key. Just hit the URL with dimensions.',
        exampleEndpoint: 'GET /200/300 — returns a 200x300 random image',
        dataFormat: 'json',
        cors: true,
    },

    // ── Data & Testing ──
    {
        name: 'JSONPlaceholder',
        url: 'https://jsonplaceholder.typicode.com',
        docsUrl: 'https://jsonplaceholder.typicode.com/guide/',
        category: 'data_test',
        auth: 'none',
        freeTier: true,
        description: 'Fake REST API for prototyping: posts, comments, users, todos, albums, photos.',
        exampleEndpoint: 'GET /posts/1',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'RandomUser',
        url: 'https://randomuser.me/api',
        docsUrl: 'https://randomuser.me/documentation',
        category: 'data_test',
        auth: 'none',
        freeTier: true,
        description: 'Random user generator: name, email, photo, address, phone. Great for user lists.',
        exampleEndpoint: 'GET /?results=10',
        dataFormat: 'json',
        cors: true,
    },
    {
        name: 'DummyJSON',
        url: 'https://dummyjson.com',
        docsUrl: 'https://dummyjson.com/docs',
        category: 'data_test',
        auth: 'none',
        freeTier: true,
        description: 'Fake data for products, carts, users, quotes, recipes. Supports auth simulation.',
        exampleEndpoint: 'GET /products?limit=10',
        dataFormat: 'json',
        cors: true,
    },

    // ── News ──
    {
        name: 'GNews',
        url: 'https://gnews.io/api/v4',
        docsUrl: 'https://gnews.io/docs/v4',
        category: 'news',
        auth: 'apiKey',
        freeTier: true,
        description: 'News articles from 60k sources. Search, top headlines, by topic.',
        exampleEndpoint: 'GET /top-headlines?category=technology&lang=en&token={API_KEY}',
        rateLimit: '100/day',
        dataFormat: 'json',
        cors: true,
    },

    // ── Social ──
    {
        name: 'Reddit',
        url: 'https://www.reddit.com',
        docsUrl: 'https://www.reddit.com/dev/api/',
        category: 'social',
        auth: 'none',
        freeTier: true,
        description: 'Public Reddit data: subreddits, posts, comments. Append .json to any page.',
        exampleEndpoint: 'GET /r/programming.json?limit=10',
        rateLimit: '60/minute',
        dataFormat: 'json',
        cors: false,
    },
    {
        name: 'GitHub API',
        url: 'https://api.github.com',
        docsUrl: 'https://docs.github.com/en/rest',
        category: 'social',
        auth: 'none',
        freeTier: true,
        description: 'GitHub repos, users, orgs, issues, PRs. No key for public data (60 req/hr).',
        exampleEndpoint: 'GET /users/octocat/repos',
        rateLimit: '60/hour (unauthenticated)',
        dataFormat: 'json',
        cors: true,
    },

    // ── Sports ──
    {
        name: 'NBA API (balldontlie)',
        url: 'https://www.balldontlie.io/api/v1',
        docsUrl: 'https://www.balldontlie.io/#introduction',
        category: 'sports',
        auth: 'none',
        freeTier: true,
        description: 'NBA players, teams, games, stats. No key needed.',
        exampleEndpoint: 'GET /players?search=lebron',
        rateLimit: '60/minute',
        dataFormat: 'json',
        cors: true,
    },

    // ── Health ──
    {
        name: 'Open Disease (disease.sh)',
        url: 'https://disease.sh/v3/covid-19',
        docsUrl: 'https://disease.sh/docs/',
        category: 'health',
        auth: 'none',
        freeTier: true,
        description: 'COVID-19 + influenza data globally. No key needed.',
        exampleEndpoint: 'GET /countries/USA',
        dataFormat: 'json',
        cors: true,
    },

    // ── Development ──
    {
        name: 'httpbin',
        url: 'https://httpbin.org',
        docsUrl: 'https://httpbin.org/',
        category: 'development',
        auth: 'none',
        freeTier: true,
        description: 'HTTP request/response testing. Echo headers, test methods, status codes.',
        exampleEndpoint: 'GET /get — echoes your request back',
        dataFormat: 'json',
        cors: true,
    },
];

/* ═══════════════════════════════════════════
   QUERY ENGINE
   ═══════════════════════════════════════════ */

/**
 * Find relevant APIs for a set of capabilities or domain keywords.
 * Uses keyword matching against API descriptions and categories.
 */
export function queryRegistry(
    capabilities: string[],
    domainKeywords: string[],
): APIEntry[] {
    const searchTerms = [...capabilities, ...domainKeywords]
        .map(s => s.toLowerCase());

    // Category mapping: keyword → category
    const KEYWORD_TO_CATEGORY: Record<string, APICategory[]> = {
        'weather': ['weather'],
        'forecast': ['weather'],
        'temperature': ['weather'],
        'climate': ['weather'],
        'stock': ['finance'],
        'crypto': ['finance'],
        'trading': ['finance'],
        'currency': ['finance'],
        'exchange rate': ['finance'],
        'bitcoin': ['finance'],
        'pokemon': ['games'],
        'game': ['games'],
        'trivia': ['games'],
        'quiz': ['games'],
        'rpg': ['games'],
        'chess': ['games'],
        'dnd': ['games'],
        'dungeons': ['games'],
        'map': ['maps'],
        'location': ['maps'],
        'geocod': ['maps'],
        'country': ['maps'],
        'coordinates': ['maps'],
        'photo': ['media'],
        'image': ['media'],
        'movie': ['media'],
        'film': ['media'],
        'tv show': ['media'],
        'music': ['media'],
        'placeholder': ['data_test', 'media'],
        'mock': ['data_test'],
        'fake data': ['data_test'],
        'prototype': ['data_test'],
        'user profile': ['data_test', 'social'],
        'news': ['news'],
        'article': ['news'],
        'headline': ['news'],
        'social': ['social'],
        'reddit': ['social'],
        'github': ['social', 'development'],
        'sport': ['sports'],
        'nba': ['sports'],
        'health': ['health'],
        'medical': ['health'],
        'api test': ['development'],
        'http': ['development'],
        'ecommerce': ['ecommerce'],
        'product': ['ecommerce', 'data_test'],
        'shop': ['ecommerce'],
    };

    const matchedCategories = new Set<APICategory>();

    for (const term of searchTerms) {
        for (const [keyword, categories] of Object.entries(KEYWORD_TO_CATEGORY)) {
            if (term.includes(keyword)) {
                for (const cat of categories) matchedCategories.add(cat);
            }
        }
    }

    // Also do fuzzy match on API descriptions
    const results = new Set<APIEntry>();

    // Category matches
    for (const api of REGISTRY) {
        if (matchedCategories.has(api.category)) {
            results.add(api);
        }
    }

    // Direct description matches
    for (const api of REGISTRY) {
        const desc = (api.description + ' ' + api.name).toLowerCase();
        for (const term of searchTerms) {
            if (term.length > 3 && desc.includes(term)) {
                results.add(api);
                break;
            }
        }
    }

    return Array.from(results);
}

/**
 * Format matched APIs into context for the agent's system prompt.
 * Compact but informative — actual endpoints the agent can use.
 */
export function formatAPIsForContext(apis: APIEntry[]): string {
    if (apis.length === 0) return '';

    const grouped: Record<string, APIEntry[]> = {};
    for (const api of apis) {
        if (!grouped[api.category]) grouped[api.category] = [];
        grouped[api.category].push(api);
    }

    const sections: string[] = [];
    sections.push('\n## Available Public APIs (free, no configuration needed)');

    for (const [category, entries] of Object.entries(grouped)) {
        sections.push(`\n### ${category.replace(/_/g, ' ').toUpperCase()}`);
        for (const api of entries.slice(0, 5)) { // Max 5 per category
            const authNote = api.auth === 'none' ? 'NO KEY' :
                api.auth === 'apiKey' ? 'needs API key (free)' : 'OAuth';
            sections.push(
                `- **${api.name}** (${authNote}${api.rateLimit ? `, ${api.rateLimit}` : ''})` +
                `\n  ${api.description}` +
                `\n  Endpoint: \`${api.exampleEndpoint}\`` +
                `\n  Docs: ${api.docsUrl}`
            );
        }
    }

    return sections.join('\n');
}

/** Get all registered APIs */
export function getAllAPIs(): readonly APIEntry[] {
    return REGISTRY;
}

/** Get APIs by category */
export function getAPIsByCategory(category: APICategory): APIEntry[] {
    return REGISTRY.filter(a => a.category === category);
}

/** Get all unique categories */
export function getCategories(): APICategory[] {
    return Array.from(new Set(REGISTRY.map(a => a.category)));
}
