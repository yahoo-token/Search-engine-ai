/**
 * Comprehensive seed list of popular websites for database population
 * Organized by category with expected metadata and priority
 */

export interface SeedWebsite {
  url: string;
  domain: string;
  category: 'shopping' | 'companies' | 'news' | 'saas' | 'cloud' | 'web3';
  priority: number; // 1-100, higher = more important
  expectedTitle?: string;
  description?: string;
}

export const SEED_WEBSITES: SeedWebsite[] = [
  // Shopping (15 sites)
  {
    url: 'https://amazon.com',
    domain: 'amazon.com',
    category: 'shopping',
    priority: 95,
    expectedTitle: 'Amazon.com. Spend less. Smile more.',
    description: 'Online shopping from a great selection at competitive prices'
  },
  {
    url: 'https://shopify.com',
    domain: 'shopify.com',
    category: 'shopping',
    priority: 90,
    expectedTitle: 'Shopify - Start and grow your e-commerce business',
    description: 'E-commerce platform for online stores and retail point-of-sale systems'
  },
  {
    url: 'https://ebay.com',
    domain: 'ebay.com',
    category: 'shopping',
    priority: 85,
    expectedTitle: 'Electronics, Cars, Fashion, Collectibles & More | eBay',
    description: 'Buy and sell electronics, cars, fashion apparel, collectibles, sporting goods, and more'
  },
  {
    url: 'https://stripe.com',
    domain: 'stripe.com',
    category: 'shopping',
    priority: 88,
    expectedTitle: 'Stripe | Financial Infrastructure for the Internet',
    description: 'Online payment processing for internet businesses'
  },
  {
    url: 'https://paypal.com',
    domain: 'paypal.com',
    category: 'shopping',
    priority: 87,
    expectedTitle: 'PayPal - The safer, easier way to pay online',
    description: 'Send money, pay online or set up a merchant account'
  },
  {
    url: 'https://squareup.com',
    domain: 'squareup.com',
    category: 'shopping',
    priority: 80,
    expectedTitle: 'Square - Start selling with free POS software',
    description: 'Payment solutions and business tools for sellers'
  },
  {
    url: 'https://etsy.com',
    domain: 'etsy.com',
    category: 'shopping',
    priority: 75,
    expectedTitle: 'Etsy - Shop for handmade, vintage, custom, and creative goods',
    description: 'Global marketplace for unique and creative goods'
  },
  {
    url: 'https://walmart.com',
    domain: 'walmart.com',
    category: 'shopping',
    priority: 85,
    expectedTitle: 'Walmart.com | Save Money. Live Better.',
    description: 'Shop online at Walmart.com for Every Day Low Prices'
  },
  {
    url: 'https://target.com',
    domain: 'target.com',
    category: 'shopping',
    priority: 80,
    expectedTitle: 'Target : Expect More. Pay Less.',
    description: 'Shop Target for furniture, clothing, grocery, electronics and more'
  },
  {
    url: 'https://bestbuy.com',
    domain: 'bestbuy.com',
    category: 'shopping',
    priority: 78,
    expectedTitle: 'Best Buy | Official Online Store | Shop Now & Save',
    description: 'Shop Best Buy for electronics, computers, appliances, cell phones, video games & more'
  },
  {
    url: 'https://costco.com',
    domain: 'costco.com',
    category: 'shopping',
    priority: 75,
    expectedTitle: 'Welcome to Costco Wholesale',
    description: 'Shop Costco for electronics, computers, appliances, groceries and more'
  },
  {
    url: 'https://homedepot.com',
    domain: 'homedepot.com',
    category: 'shopping',
    priority: 72,
    expectedTitle: 'The Home Depot',
    description: 'Shop for home improvement, appliances, tools, and more'
  },
  {
    url: 'https://wayfair.com',
    domain: 'wayfair.com',
    category: 'shopping',
    priority: 70,
    expectedTitle: 'Wayfair | Furniture and Home Decor',
    description: 'Shop for furniture, home accessories, rugs, and more'
  },
  {
    url: 'https://overstock.com',
    domain: 'overstock.com',
    category: 'shopping',
    priority: 65,
    expectedTitle: 'Overstock.com | The Best Deals Online',
    description: 'Shop for furniture, home goods, jewelry and more'
  },
  {
    url: 'https://alibaba.com',
    domain: 'alibaba.com',
    category: 'shopping',
    priority: 82,
    expectedTitle: 'Alibaba.com - Global B2B Marketplace',
    description: 'Find quality manufacturers, suppliers, exporters, importers, buyers, wholesalers'
  },

  // Companies (15 sites)
  {
    url: 'https://google.com',
    domain: 'google.com',
    category: 'companies',
    priority: 100,
    expectedTitle: 'Google',
    description: 'Search the world\'s information including webpages, images, videos and more'
  },
  {
    url: 'https://microsoft.com',
    domain: 'microsoft.com',
    category: 'companies',
    priority: 95,
    expectedTitle: 'Microsoft - Cloud, Computers, Apps & Gaming',
    description: 'Explore Microsoft products and services for your home or business'
  },
  {
    url: 'https://apple.com',
    domain: 'apple.com',
    category: 'companies',
    priority: 95,
    expectedTitle: 'Apple',
    description: 'Discover the innovative world of Apple and shop everything iPhone, iPad, Apple Watch, Mac, and Apple TV'
  },
  {
    url: 'https://meta.com',
    domain: 'meta.com',
    category: 'companies',
    priority: 90,
    expectedTitle: 'Meta | Social Metaverse Company',
    description: 'Meta is helping to build the metaverse, a place where we\'ll play and connect in 3D'
  },
  {
    url: 'https://tesla.com',
    domain: 'tesla.com',
    category: 'companies',
    priority: 88,
    expectedTitle: 'Electric Cars, Solar & Clean Energy | Tesla',
    description: 'Tesla is accelerating the world\'s transition to sustainable energy'
  },
  {
    url: 'https://netflix.com',
    domain: 'netflix.com',
    category: 'companies',
    priority: 85,
    expectedTitle: 'Netflix - Watch TV Shows Online, Watch Movies Online',
    description: 'Watch Netflix movies & TV shows online or stream right to your smart TV, game console, PC, Mac, mobile, tablet and more'
  },
  {
    url: 'https://disney.com',
    domain: 'disney.com',
    category: 'companies',
    priority: 80,
    expectedTitle: 'The Walt Disney Company',
    description: 'The mission of The Walt Disney Company is to entertain, inform and inspire people around the globe'
  },
  {
    url: 'https://samsung.com',
    domain: 'samsung.com',
    category: 'companies',
    priority: 82,
    expectedTitle: 'Samsung US | Mobile | Computing | Home Electronics',
    description: 'Discover the latest in electronic & smart appliance technology with Samsung'
  },
  {
    url: 'https://sony.com',
    domain: 'sony.com',
    category: 'companies',
    priority: 78,
    expectedTitle: 'Sony Electronics | Audio, Video, Gaming & Entertainment',
    description: 'Sony Corporation of America, located in New York, NY, is the U.S. headquarters of Sony Group Corporation'
  },
  {
    url: 'https://intel.com',
    domain: 'intel.com',
    category: 'companies',
    priority: 80,
    expectedTitle: 'Intel | Data Center Solutions, IoT, and PC Innovation',
    description: 'Intel technologies may require enabled hardware, software or service activation'
  },
  {
    url: 'https://adobe.com',
    domain: 'adobe.com',
    category: 'companies',
    priority: 85,
    expectedTitle: 'Adobe: Creative, marketing and document management solutions',
    description: 'Adobe is changing the world through digital experiences'
  },
  {
    url: 'https://oracle.com',
    domain: 'oracle.com',
    category: 'companies',
    priority: 75,
    expectedTitle: 'Oracle | Cloud Applications and Cloud Platform',
    description: 'Oracle offers integrated suites of applications plus secure, autonomous infrastructure in the Oracle Cloud'
  },
  {
    url: 'https://ibm.com',
    domain: 'ibm.com',
    category: 'companies',
    priority: 78,
    expectedTitle: 'IBM - United States',
    description: 'IBM\'s greatest invention is the IBMer. We believe that through the application of intelligence, reason and science, we can improve business, society and the human condition'
  },
  {
    url: 'https://hp.com',
    domain: 'hp.com',
    category: 'companies',
    priority: 72,
    expectedTitle: 'HP® Official Site | Laptop Computers, Desktops, Printers, Ink & Toner',
    description: 'Shop for business and personal laptops, desktop computers, printers, computer accessories, and more'
  },
  {
    url: 'https://nvidia.com',
    domain: 'nvidia.com',
    category: 'companies',
    priority: 88,
    expectedTitle: 'NVIDIA - Artificial Intelligence Computing Company',
    description: 'NVIDIA invented the GPU and drives advances in AI, HPC, gaming, creative design, self-driving cars, and robotics'
  },

  // News (12 sites)
  {
    url: 'https://cnn.com',
    domain: 'cnn.com',
    category: 'news',
    priority: 90,
    expectedTitle: 'CNN - Breaking News, Latest News and Videos',
    description: 'View the latest news and breaking news today for U.S., world, weather, entertainment, politics and health'
  },
  {
    url: 'https://bbc.com',
    domain: 'bbc.com',
    category: 'news',
    priority: 92,
    expectedTitle: 'BBC - Homepage',
    description: 'Breaking news, sport, TV, radio and a whole lot more'
  },
  {
    url: 'https://techcrunch.com',
    domain: 'techcrunch.com',
    category: 'news',
    priority: 88,
    expectedTitle: 'TechCrunch | Startup and Technology News',
    description: 'TechCrunch | Reporting on the business of technology, startups, venture capital funding, and Silicon Valley'
  },
  {
    url: 'https://theverge.com',
    domain: 'theverge.com',
    category: 'news',
    priority: 85,
    expectedTitle: 'The Verge',
    description: 'The Verge covers the intersection of technology, science, art, and culture'
  },
  {
    url: 'https://wired.com',
    domain: 'wired.com',
    category: 'news',
    priority: 82,
    expectedTitle: 'WIRED',
    description: 'Get in-depth coverage of current and future trends in technology, and how they are shaping business, entertainment, communications, science, politics, and society'
  },
  {
    url: 'https://reuters.com',
    domain: 'reuters.com',
    category: 'news',
    priority: 88,
    expectedTitle: 'Reuters | Breaking International News & Views',
    description: 'Reuters.com brings you the latest news from around the world, covering breaking news in business, politics, world, technology, and more'
  },
  {
    url: 'https://arstechnica.com',
    domain: 'arstechnica.com',
    category: 'news',
    priority: 78,
    expectedTitle: 'Ars Technica',
    description: 'The PC enthusiast\'s resource. Power users and the tools they love, without computing religion'
  },
  {
    url: 'https://engadget.com',
    domain: 'engadget.com',
    category: 'news',
    priority: 75,
    expectedTitle: 'Engadget | Technology News & Reviews',
    description: 'Find the latest technology news and expert tech product reviews'
  },
  {
    url: 'https://mashable.com',
    domain: 'mashable.com',
    category: 'news',
    priority: 72,
    expectedTitle: 'Mashable',
    description: 'Mashable is a global, multi-platform media and entertainment company'
  },
  {
    url: 'https://venturebeat.com',
    domain: 'venturebeat.com',
    category: 'news',
    priority: 75,
    expectedTitle: 'VentureBeat | Transformative tech coverage that matters',
    description: 'VentureBeat is the leading source for transformative tech news and events that provide deep context to fuel decision-making and career success'
  },
  {
    url: 'https://forbes.com',
    domain: 'forbes.com',
    category: 'news',
    priority: 85,
    expectedTitle: 'Forbes',
    description: 'Forbes is a leading source for reliable business news and financial information'
  },
  {
    url: 'https://bloomberg.com',
    domain: 'bloomberg.com',
    category: 'news',
    priority: 88,
    expectedTitle: 'Bloomberg.com',
    description: 'Bloomberg delivers business and markets news, data, analysis, and video to the world'
  },

  // SaaS (10 sites)
  {
    url: 'https://slack.com',
    domain: 'slack.com',
    category: 'saas',
    priority: 90,
    expectedTitle: 'Slack is your productivity platform | Slack',
    description: 'Slack is a new way to communicate with your team. It\'s faster, better organized, and more secure than email'
  },
  {
    url: 'https://notion.so',
    domain: 'notion.so',
    category: 'saas',
    priority: 88,
    expectedTitle: 'Notion – The all-in-one workspace for your notes, tasks, wikis, and databases',
    description: 'A new tool that blends your everyday work apps into one. It\'s the all-in-one workspace for you and your team'
  },
  {
    url: 'https://figma.com',
    domain: 'figma.com',
    category: 'saas',
    priority: 85,
    expectedTitle: 'Figma: the collaborative interface design tool',
    description: 'Figma helps teams create, test, and ship better designs from start to finish'
  },
  {
    url: 'https://zoom.us',
    domain: 'zoom.us',
    category: 'saas',
    priority: 88,
    expectedTitle: 'Video Conferencing, Web Conferencing, Webinars, Screen Sharing - Zoom',
    description: 'Zoom is the leader in modern enterprise video communications, with an easy, reliable cloud platform for video and audio conferencing'
  },
  {
    url: 'https://salesforce.com',
    domain: 'salesforce.com',
    category: 'saas',
    priority: 90,
    expectedTitle: 'Salesforce: We Bring Companies and Customers Together',
    description: 'Salesforce is the global leader in Customer Relationship Management (CRM)'
  },
  {
    url: 'https://hubspot.com',
    domain: 'hubspot.com',
    category: 'saas',
    priority: 85,
    expectedTitle: 'HubSpot | Inbound Marketing, Sales, and Service Software',
    description: 'HubSpot offers a full platform of marketing, sales, customer service, and CRM software'
  },
  {
    url: 'https://asana.com',
    domain: 'asana.com',
    category: 'saas',
    priority: 80,
    expectedTitle: 'Asana • Work management platform for teams',
    description: 'From the small stuff to the big picture, Asana organizes work so teams know what to do, why it matters, and how to get it done'
  },
  {
    url: 'https://trello.com',
    domain: 'trello.com',
    category: 'saas',
    priority: 78,
    expectedTitle: 'Trello',
    description: 'Trello lets you work more collaboratively and get more done'
  },
  {
    url: 'https://dropbox.com',
    domain: 'dropbox.com',
    category: 'saas',
    priority: 82,
    expectedTitle: 'Dropbox',
    description: 'Dropbox helps people and teams focus on the work that matters'
  },
  {
    url: 'https://atlassian.com',
    domain: 'atlassian.com',
    category: 'saas',
    priority: 80,
    expectedTitle: 'Atlassian | Software Development and Collaboration Tools',
    description: 'Millions of users globally rely on Atlassian products every day for improving software development, project management, collaboration, and code quality'
  },

  // Cloud (10 sites)
  {
    url: 'https://aws.amazon.com',
    domain: 'aws.amazon.com',
    category: 'cloud',
    priority: 95,
    expectedTitle: 'Amazon Web Services (AWS) - Cloud Computing Services',
    description: 'Amazon Web Services offers reliable, scalable, and inexpensive cloud computing services'
  },
  {
    url: 'https://azure.microsoft.com',
    domain: 'azure.microsoft.com',
    category: 'cloud',
    priority: 90,
    expectedTitle: 'Microsoft Azure Cloud Computing Platform & Services',
    description: 'Microsoft Azure is an ever-expanding set of cloud computing services to help your organization meet its business challenges'
  },
  {
    url: 'https://cloud.google.com',
    domain: 'cloud.google.com',
    category: 'cloud',
    priority: 88,
    expectedTitle: 'Google Cloud Platform',
    description: 'Meet your business challenges head on with cloud computing services from Google'
  },
  {
    url: 'https://vercel.com',
    domain: 'vercel.com',
    category: 'cloud',
    priority: 85,
    expectedTitle: 'Vercel: Build and deploy the best Web experiences',
    description: 'Vercel is the platform for frontend developers, providing the speed and reliability innovators need to create at the moment of inspiration'
  },
  {
    url: 'https://netlify.com',
    domain: 'netlify.com',
    category: 'cloud',
    priority: 82,
    expectedTitle: 'Netlify: Develop & deploy the best web experiences in record time',
    description: 'Deploy modern static websites with Netlify. Get CDN, Continuous deployment, 1-click HTTPS, and all the services you need'
  },
  {
    url: 'https://cloudflare.com',
    domain: 'cloudflare.com',
    category: 'cloud',
    priority: 88,
    expectedTitle: 'Cloudflare - The Web Performance & Security Company',
    description: 'Cloudflare, Inc. is the leading connectivity cloud company. It empowers organizations to make their employees, applications and networks faster and more secure everywhere'
  },
  {
    url: 'https://digitalocean.com',
    domain: 'digitalocean.com',
    category: 'cloud',
    priority: 80,
    expectedTitle: 'DigitalOcean | Cloud Infrastructure for Developers',
    description: 'Deploy and scale seamlessly. Our optimized configuration process saves your team time when running and scaling distributed applications, AI & machine learning workloads, hosted services, client websites, or CI/CD environments'
  },
  {
    url: 'https://heroku.com',
    domain: 'heroku.com',
    category: 'cloud',
    priority: 78,
    expectedTitle: 'Heroku: Cloud Application Platform',
    description: 'Heroku is a platform as a service (PaaS) that enables developers to build, run, and operate applications entirely in the cloud'
  },
  {
    url: 'https://railway.app',
    domain: 'railway.app',
    category: 'cloud',
    priority: 75,
    expectedTitle: 'Railway',
    description: 'Made for any language, for projects big and small. Railway is the cloud that takes the complexity out of shipping software'
  },
  {
    url: 'https://render.com',
    domain: 'render.com',
    category: 'cloud',
    priority: 72,
    expectedTitle: 'Render · Cloud Computing, Simplified',
    description: 'The modern cloud platform: Build, deploy, and scale your apps with unparalleled ease – from your first user to your billionth'
  },

  // Web3 (8 sites)
  {
    url: 'https://coinbase.com',
    domain: 'coinbase.com',
    category: 'web3',
    priority: 90,
    expectedTitle: 'Coinbase | Buy & Sell Bitcoin, Ethereum, and many other cryptocurrencies',
    description: 'Coinbase is a secure online platform for buying, selling, transferring, and storing cryptocurrency'
  },
  {
    url: 'https://binance.com',
    domain: 'binance.com',
    category: 'web3',
    priority: 88,
    expectedTitle: 'Binance | Cryptocurrency Exchange for Bitcoin, Ethereum & Altcoins',
    description: 'Binance cryptocurrency exchange - We operate the worlds biggest bitcoin exchange and altcoin crypto exchange in the world by volume'
  },
  {
    url: 'https://ethereum.org',
    domain: 'ethereum.org',
    category: 'web3',
    priority: 92,
    expectedTitle: 'Home | ethereum.org',
    description: 'Ethereum is a global, decentralized platform for money and new kinds of applications'
  },
  {
    url: 'https://opensea.io',
    domain: 'opensea.io',
    category: 'web3',
    priority: 85,
    expectedTitle: 'OpenSea, the largest NFT marketplace',
    description: 'Discover, collect, and sell extraordinary NFTs. OpenSea is the world\'s first and largest web3 marketplace for NFTs and crypto collectibles'
  },
  {
    url: 'https://uniswap.org',
    domain: 'uniswap.org',
    category: 'web3',
    priority: 82,
    expectedTitle: 'Uniswap Protocol',
    description: 'A growing network of DeFi Apps. Developers, traders, and liquidity providers participate together in a financial marketplace that is open and accessible to all'
  },
  {
    url: 'https://metamask.io',
    domain: 'metamask.io',
    category: 'web3',
    priority: 88,
    expectedTitle: 'MetaMask',
    description: 'MetaMask is a crypto wallet & gateway to blockchain apps'
  },
  {
    url: 'https://chainlink.community',
    domain: 'chainlink.community',
    category: 'web3',
    priority: 78,
    expectedTitle: 'Chainlink | Connecting smart contracts with real-world data and services',
    description: 'Chainlink greatly expands the capabilities of smart contracts by enabling access to real-world data and off-chain computation while maintaining the security and reliability guarantees inherent to blockchain technology'
  },
  {
    url: 'https://polygon.technology',
    domain: 'polygon.technology',
    category: 'web3',
    priority: 80,
    expectedTitle: 'Polygon | Ethereum scaling and infrastructure development',
    description: 'Polygon is a decentralized Ethereum scaling platform that enables developers to build scalable user-friendly dApps with low transaction fees without ever sacrificing on security'
  }
];

// Category distribution helper
export const getCategorySummary = () => {
  const categories = SEED_WEBSITES.reduce((acc, site) => {
    acc[site.category] = (acc[site.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    total: SEED_WEBSITES.length,
    categories
  };
};

// Get websites by category
export const getWebsitesByCategory = (category: string) => {
  return SEED_WEBSITES.filter(site => site.category === category);
};

// Get high priority websites
export const getHighPriorityWebsites = (minPriority: number = 80) => {
  return SEED_WEBSITES.filter(site => site.priority >= minPriority);
};