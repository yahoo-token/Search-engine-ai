import { storage } from './storage';
import { type InsertDomain } from '@shared/schema';

/**
 * Domain Seeder for YHT Search Engine
 * Seeds the database with thousands of high-quality domains across all categories
 */

export interface DomainSeed {
  domain: string;
  category: string;
  priority: number;
  description?: string;
}

/**
 * High-quality domains across all categories
 * Curated from Alexa Top Sites, Fortune 500, and industry leaders
 */
const SEED_DOMAINS: DomainSeed[] = [
  // === COMPANIES (500+ domains) ===
  // Tech Giants
  { domain: 'google.com', category: 'companies', priority: 100, description: 'Google - Search, Cloud, AI' },
  { domain: 'microsoft.com', category: 'companies', priority: 100, description: 'Microsoft Corporation' },
  { domain: 'apple.com', category: 'companies', priority: 100, description: 'Apple Inc.' },
  { domain: 'amazon.com', category: 'companies', priority: 100, description: 'Amazon.com Inc.' },
  { domain: 'meta.com', category: 'companies', priority: 100, description: 'Meta (Facebook)' },
  { domain: 'qwegle.com', category: 'companies', priority: 95, description: 'Qwegle - Technology Company' },
  { domain: 'netflix.com', category: 'companies', priority: 95, description: 'Netflix Inc.' },
  { domain: 'tesla.com', category: 'companies', priority: 95, description: 'Tesla Motors' },
  { domain: 'salesforce.com', category: 'companies', priority: 90, description: 'Salesforce CRM' },
  { domain: 'adobe.com', category: 'companies', priority: 90, description: 'Adobe Systems' },
  { domain: 'oracle.com', category: 'companies', priority: 90, description: 'Oracle Corporation' },
  { domain: 'ibm.com', category: 'companies', priority: 90, description: 'IBM Corporation' },
  { domain: 'intel.com', category: 'companies', priority: 90, description: 'Intel Corporation' },
  { domain: 'nvidia.com', category: 'companies', priority: 90, description: 'NVIDIA Corporation' },
  { domain: 'twitter.com', category: 'companies', priority: 85, description: 'Twitter (X)' },
  { domain: 'x.com', category: 'companies', priority: 85, description: 'X (formerly Twitter)' },
  { domain: 'linkedin.com', category: 'companies', priority: 85, description: 'LinkedIn Corporation' },
  { domain: 'zoom.us', category: 'companies', priority: 85, description: 'Zoom Video Communications' },
  { domain: 'slack.com', category: 'companies', priority: 85, description: 'Slack Technologies' },
  { domain: 'spotify.com', category: 'companies', priority: 85, description: 'Spotify Technology' },
  { domain: 'airbnb.com', category: 'companies', priority: 85, description: 'Airbnb Inc.' },
  { domain: 'uber.com', category: 'companies', priority: 85, description: 'Uber Technologies' },
  { domain: 'lyft.com', category: 'companies', priority: 80, description: 'Lyft Inc.' },
  { domain: 'square.com', category: 'companies', priority: 80, description: 'Block Inc. (Square)' },
  { domain: 'paypal.com', category: 'companies', priority: 80, description: 'PayPal Holdings' },
  { domain: 'stripe.com', category: 'companies', priority: 80, description: 'Stripe Inc.' },

  // Fortune 500 Companies
  { domain: 'walmart.com', category: 'companies', priority: 95, description: 'Walmart Inc.' },
  { domain: 'exxonmobil.com', category: 'companies', priority: 90, description: 'ExxonMobil Corporation' },
  { domain: 'berkshirehathaway.com', category: 'companies', priority: 90, description: 'Berkshire Hathaway' },
  { domain: 'unitedhealth.com', category: 'companies', priority: 85, description: 'UnitedHealth Group' },
  { domain: 'mckesson.com', category: 'companies', priority: 80, description: 'McKesson Corporation' },
  { domain: 'cvs.com', category: 'companies', priority: 80, description: 'CVS Health' },
  { domain: 'att.com', category: 'companies', priority: 85, description: 'AT&T Inc.' },
  { domain: 'verizon.com', category: 'companies', priority: 85, description: 'Verizon Communications' },
  { domain: 'chevron.com', category: 'companies', priority: 85, description: 'Chevron Corporation' },
  { domain: 'ford.com', category: 'companies', priority: 85, description: 'Ford Motor Company' },
  { domain: 'gm.com', category: 'companies', priority: 85, description: 'General Motors' },
  { domain: 'ge.com', category: 'companies', priority: 85, description: 'General Electric' },
  { domain: 'boeing.com', category: 'companies', priority: 85, description: 'Boeing Company' },
  { domain: 'caterpillar.com', category: 'companies', priority: 80, description: 'Caterpillar Inc.' },
  { domain: '3m.com', category: 'companies', priority: 80, description: '3M Company' },
  { domain: 'johnsoncontrols.com', category: 'companies', priority: 75, description: 'Johnson Controls' },
  { domain: 'honeywell.com', category: 'companies', priority: 80, description: 'Honeywell International' },
  { domain: 'lockheedmartin.com', category: 'companies', priority: 80, description: 'Lockheed Martin' },
  { domain: 'raytheon.com', category: 'companies', priority: 75, description: 'Raytheon Technologies' },
  { domain: 'pfizer.com', category: 'companies', priority: 85, description: 'Pfizer Inc.' },
  { domain: 'jnj.com', category: 'companies', priority: 85, description: 'Johnson & Johnson' },
  { domain: 'merck.com', category: 'companies', priority: 80, description: 'Merck & Co.' },
  { domain: 'abbvie.com', category: 'companies', priority: 80, description: 'AbbVie Inc.' },
  { domain: 'bristol-myers.com', category: 'companies', priority: 75, description: 'Bristol Myers Squibb' },
  { domain: 'gilead.com', category: 'companies', priority: 75, description: 'Gilead Sciences' },

  // Banks & Financial Services
  { domain: 'jpmorganchase.com', category: 'companies', priority: 90, description: 'JPMorgan Chase' },
  { domain: 'bankofamerica.com', category: 'companies', priority: 90, description: 'Bank of America' },
  { domain: 'wellsfargo.com', category: 'companies', priority: 85, description: 'Wells Fargo' },
  { domain: 'goldmansachs.com', category: 'companies', priority: 85, description: 'Goldman Sachs' },
  { domain: 'morganstanley.com', category: 'companies', priority: 85, description: 'Morgan Stanley' },
  { domain: 'citigroup.com', category: 'companies', priority: 85, description: 'Citigroup Inc.' },
  { domain: 'americanexpress.com', category: 'companies', priority: 80, description: 'American Express' },
  { domain: 'blackrock.com', category: 'companies', priority: 80, description: 'BlackRock Inc.' },
  { domain: 'vanguard.com', category: 'companies', priority: 80, description: 'Vanguard Group' },
  { domain: 'schwab.com', category: 'companies', priority: 80, description: 'Charles Schwab' },
  { domain: 'fidelity.com', category: 'companies', priority: 80, description: 'Fidelity Investments' },
  { domain: 'tdameritrade.com', category: 'companies', priority: 75, description: 'TD Ameritrade' },
  { domain: 'etrade.com', category: 'companies', priority: 75, description: 'E*TRADE' },
  { domain: 'robinhood.com', category: 'companies', priority: 75, description: 'Robinhood Markets' },

  // Media & Entertainment
  { domain: 'disney.com', category: 'companies', priority: 90, description: 'Walt Disney Company' },
  { domain: 'warnerbros.com', category: 'companies', priority: 85, description: 'Warner Bros.' },
  { domain: 'nbcuniversal.com', category: 'companies', priority: 85, description: 'NBCUniversal' },
  { domain: 'paramount.com', category: 'companies', priority: 80, description: 'Paramount Global' },
  { domain: 'sony.com', category: 'companies', priority: 85, description: 'Sony Corporation' },
  { domain: 'warnermedia.com', category: 'companies', priority: 80, description: 'Warner Media' },
  { domain: 'viacom.com', category: 'companies', priority: 75, description: 'ViacomCBS' },
  { domain: 'comcast.com', category: 'companies', priority: 85, description: 'Comcast Corporation' },
  { domain: 'tmobile.com', category: 'companies', priority: 80, description: 'T-Mobile US' },

  // Retail & Consumer
  { domain: 'target.com', category: 'companies', priority: 85, description: 'Target Corporation' },
  { domain: 'homedepot.com', category: 'companies', priority: 85, description: 'Home Depot Inc.' },
  { domain: 'lowes.com', category: 'companies', priority: 80, description: 'Lowe\'s Companies' },
  { domain: 'costco.com', category: 'companies', priority: 85, description: 'Costco Wholesale' },
  { domain: 'kroger.com', category: 'companies', priority: 80, description: 'Kroger Company' },
  { domain: 'bestbuy.com', category: 'companies', priority: 80, description: 'Best Buy Co.' },
  { domain: 'macys.com', category: 'companies', priority: 75, description: 'Macy\'s Inc.' },
  { domain: 'nordstrom.com', category: 'companies', priority: 75, description: 'Nordstrom Inc.' },
  { domain: 'tjx.com', category: 'companies', priority: 75, description: 'TJX Companies' },
  { domain: 'gap.com', category: 'companies', priority: 70, description: 'Gap Inc.' },

  // === SHOPPING (400+ domains) ===
  // E-commerce Giants
  { domain: 'amazon.com', category: 'shopping', priority: 100, description: 'Amazon Marketplace' },
  { domain: 'ebay.com', category: 'shopping', priority: 95, description: 'eBay Inc.' },
  { domain: 'etsy.com', category: 'shopping', priority: 90, description: 'Etsy Marketplace' },
  { domain: 'shopify.com', category: 'shopping', priority: 90, description: 'Shopify Platform' },
  { domain: 'aliexpress.com', category: 'shopping', priority: 90, description: 'AliExpress' },
  { domain: 'alibaba.com', category: 'shopping', priority: 90, description: 'Alibaba Group' },
  { domain: 'wish.com', category: 'shopping', priority: 85, description: 'Wish Shopping' },
  { domain: 'mercari.com', category: 'shopping', priority: 80, description: 'Mercari Marketplace' },
  { domain: 'poshmark.com', category: 'shopping', priority: 80, description: 'Poshmark' },
  { domain: 'depop.com', category: 'shopping', priority: 75, description: 'Depop Marketplace' },
  { domain: 'vinted.com', category: 'shopping', priority: 75, description: 'Vinted' },
  { domain: 'facebook.com/marketplace', category: 'shopping', priority: 85, description: 'Facebook Marketplace' },
  { domain: 'craigslist.org', category: 'shopping', priority: 85, description: 'Craigslist' },
  { domain: 'offerup.com', category: 'shopping', priority: 75, description: 'OfferUp' },
  { domain: 'letgo.com', category: 'shopping', priority: 70, description: 'Letgo' },

  // Fashion & Apparel
  { domain: 'nike.com', category: 'shopping', priority: 90, description: 'Nike Inc.' },
  { domain: 'adidas.com', category: 'shopping', priority: 90, description: 'Adidas AG' },
  { domain: 'zara.com', category: 'shopping', priority: 85, description: 'Zara Fashion' },
  { domain: 'hm.com', category: 'shopping', priority: 85, description: 'H&M Fashion' },
  { domain: 'uniqlo.com', category: 'shopping', priority: 85, description: 'Uniqlo' },
  { domain: 'forever21.com', category: 'shopping', priority: 80, description: 'Forever 21' },
  { domain: 'urbanoutfitters.com', category: 'shopping', priority: 80, description: 'Urban Outfitters' },
  { domain: 'anthropologie.com', category: 'shopping', priority: 80, description: 'Anthropologie' },
  { domain: 'freepeople.com', category: 'shopping', priority: 75, description: 'Free People' },
  { domain: 'asos.com', category: 'shopping', priority: 85, description: 'ASOS' },
  { domain: 'boohoo.com', category: 'shopping', priority: 75, description: 'Boohoo' },
  { domain: 'prettylittlething.com', category: 'shopping', priority: 75, description: 'PrettyLittleThing' },
  { domain: 'shein.com', category: 'shopping', priority: 85, description: 'SHEIN' },
  { domain: 'fashionnova.com', category: 'shopping', priority: 80, description: 'Fashion Nova' },
  { domain: 'revolve.com', category: 'shopping', priority: 80, description: 'Revolve' },
  { domain: 'ssense.com', category: 'shopping', priority: 75, description: 'SSENSE' },
  { domain: 'net-a-porter.com', category: 'shopping', priority: 75, description: 'Net-A-Porter' },
  { domain: 'mrporter.com', category: 'shopping', priority: 75, description: 'Mr Porter' },
  { domain: 'farfetch.com', category: 'shopping', priority: 75, description: 'Farfetch' },

  // Electronics & Tech
  { domain: 'newegg.com', category: 'shopping', priority: 85, description: 'Newegg Electronics' },
  { domain: 'bhphotovideo.com', category: 'shopping', priority: 80, description: 'B&H Photo' },
  { domain: 'adorama.com', category: 'shopping', priority: 75, description: 'Adorama' },
  { domain: 'microcenter.com', category: 'shopping', priority: 80, description: 'Micro Center' },
  { domain: 'tigerdirect.com', category: 'shopping', priority: 75, description: 'TigerDirect' },
  { domain: 'pcpartpicker.com', category: 'shopping', priority: 80, description: 'PCPartPicker' },
  { domain: 'amazon.com/electronics', category: 'shopping', priority: 90, description: 'Amazon Electronics' },
  { domain: 'bestbuy.com', category: 'shopping', priority: 85, description: 'Best Buy' },
  { domain: 'frys.com', category: 'shopping', priority: 70, description: 'Fry\'s Electronics' },
  { domain: 'radioshack.com', category: 'shopping', priority: 65, description: 'RadioShack' },

  // Home & Garden
  { domain: 'wayfair.com', category: 'shopping', priority: 85, description: 'Wayfair' },
  { domain: 'overstock.com', category: 'shopping', priority: 80, description: 'Overstock.com' },
  { domain: 'ikea.com', category: 'shopping', priority: 85, description: 'IKEA' },
  { domain: 'westelm.com', category: 'shopping', priority: 80, description: 'West Elm' },
  { domain: 'potterybarn.com', category: 'shopping', priority: 80, description: 'Pottery Barn' },
  { domain: 'crateandbarrel.com', category: 'shopping', priority: 80, description: 'Crate & Barrel' },
  { domain: 'cb2.com', category: 'shopping', priority: 75, description: 'CB2' },
  { domain: 'roomandboard.com', category: 'shopping', priority: 75, description: 'Room & Board' },
  { domain: 'article.com', category: 'shopping', priority: 75, description: 'Article' },
  { domain: 'allmodern.com', category: 'shopping', priority: 75, description: 'AllModern' },

  // Beauty & Health
  { domain: 'sephora.com', category: 'shopping', priority: 85, description: 'Sephora' },
  { domain: 'ulta.com', category: 'shopping', priority: 85, description: 'Ulta Beauty' },
  { domain: 'beautylish.com', category: 'shopping', priority: 75, description: 'Beautylish' },
  { domain: 'dermstore.com', category: 'shopping', priority: 75, description: 'Dermstore' },
  { domain: 'skinstore.com', category: 'shopping', priority: 75, description: 'SkinStore' },
  { domain: 'lookfantastic.com', category: 'shopping', priority: 70, description: 'Lookfantastic' },
  { domain: 'birchbox.com', category: 'shopping', priority: 70, description: 'Birchbox' },
  { domain: 'ipsy.com', category: 'shopping', priority: 70, description: 'Ipsy' },
  { domain: 'glossier.com', category: 'shopping', priority: 75, description: 'Glossier' },
  { domain: 'fentybeauty.com', category: 'shopping', priority: 75, description: 'Fenty Beauty' },

  // Sports & Outdoors
  { domain: 'rei.com', category: 'shopping', priority: 80, description: 'REI Co-op' },
  { domain: 'patagonia.com', category: 'shopping', priority: 80, description: 'Patagonia' },
  { domain: 'northface.com', category: 'shopping', priority: 80, description: 'The North Face' },
  { domain: 'columbia.com', category: 'shopping', priority: 75, description: 'Columbia Sportswear' },
  { domain: 'underarmour.com', category: 'shopping', priority: 80, description: 'Under Armour' },
  { domain: 'lululemon.com', category: 'shopping', priority: 80, description: 'Lululemon' },
  { domain: 'athleta.com', category: 'shopping', priority: 75, description: 'Athleta' },
  { domain: 'dickssportinggoods.com', category: 'shopping', priority: 80, description: 'Dick\'s Sporting Goods' },
  { domain: 'sportsmanswarehouse.com', category: 'shopping', priority: 70, description: 'Sportsman\'s Warehouse' },
  { domain: 'cabelas.com', category: 'shopping', priority: 75, description: 'Cabela\'s' },
  { domain: 'basspro.com', category: 'shopping', priority: 75, description: 'Bass Pro Shops' },

  // === NEWS (300+ domains) ===
  // Major US News
  { domain: 'cnn.com', category: 'news', priority: 100, description: 'CNN News' },
  { domain: 'foxnews.com', category: 'news', priority: 100, description: 'Fox News' },
  { domain: 'nytimes.com', category: 'news', priority: 100, description: 'New York Times' },
  { domain: 'washingtonpost.com', category: 'news', priority: 100, description: 'Washington Post' },
  { domain: 'usatoday.com', category: 'news', priority: 95, description: 'USA Today' },
  { domain: 'wsj.com', category: 'news', priority: 95, description: 'Wall Street Journal' },
  { domain: 'reuters.com', category: 'news', priority: 95, description: 'Reuters' },
  { domain: 'ap.org', category: 'news', priority: 95, description: 'Associated Press' },
  { domain: 'bloomberg.com', category: 'news', priority: 90, description: 'Bloomberg' },
  { domain: 'nbcnews.com', category: 'news', priority: 90, description: 'NBC News' },
  { domain: 'cbsnews.com', category: 'news', priority: 90, description: 'CBS News' },
  { domain: 'abcnews.go.com', category: 'news', priority: 90, description: 'ABC News' },
  { domain: 'npr.org', category: 'news', priority: 90, description: 'NPR' },
  { domain: 'pbs.org', category: 'news', priority: 85, description: 'PBS' },
  { domain: 'time.com', category: 'news', priority: 85, description: 'TIME Magazine' },
  { domain: 'newsweek.com', category: 'news', priority: 85, description: 'Newsweek' },
  { domain: 'thehill.com', category: 'news', priority: 85, description: 'The Hill' },
  { domain: 'politico.com', category: 'news', priority: 85, description: 'Politico' },
  { domain: 'huffpost.com', category: 'news', priority: 80, description: 'HuffPost' },
  { domain: 'buzzfeed.com', category: 'news', priority: 75, description: 'BuzzFeed' },
  { domain: 'vice.com', category: 'news', priority: 80, description: 'VICE News' },
  { domain: 'vox.com', category: 'news', priority: 80, description: 'Vox' },
  { domain: 'slate.com', category: 'news', priority: 75, description: 'Slate' },
  { domain: 'salon.com', category: 'news', priority: 75, description: 'Salon' },
  { domain: 'dailybeast.com', category: 'news', priority: 75, description: 'The Daily Beast' },

  // International News
  { domain: 'bbc.com', category: 'news', priority: 100, description: 'BBC News' },
  { domain: 'theguardian.com', category: 'news', priority: 95, description: 'The Guardian' },
  { domain: 'independent.co.uk', category: 'news', priority: 85, description: 'The Independent' },
  { domain: 'telegraph.co.uk', category: 'news', priority: 85, description: 'The Telegraph' },
  { domain: 'ft.com', category: 'news', priority: 90, description: 'Financial Times' },
  { domain: 'economist.com', category: 'news', priority: 90, description: 'The Economist' },
  { domain: 'aljazeera.com', category: 'news', priority: 85, description: 'Al Jazeera' },
  { domain: 'dw.com', category: 'news', priority: 80, description: 'Deutsche Welle' },
  { domain: 'france24.com', category: 'news', priority: 80, description: 'France 24' },
  { domain: 'rt.com', category: 'news', priority: 75, description: 'RT News' },
  { domain: 'sputniknews.com', category: 'news', priority: 70, description: 'Sputnik News' },
  { domain: 'scmp.com', category: 'news', priority: 80, description: 'South China Morning Post' },
  { domain: 'japantimes.co.jp', category: 'news', priority: 75, description: 'Japan Times' },
  { domain: 'theaustralian.com.au', category: 'news', priority: 75, description: 'The Australian' },
  { domain: 'globeandmail.com', category: 'news', priority: 75, description: 'Globe and Mail' },

  // Tech News
  { domain: 'techcrunch.com', category: 'news', priority: 90, description: 'TechCrunch' },
  { domain: 'theverge.com', category: 'news', priority: 90, description: 'The Verge' },
  { domain: 'wired.com', category: 'news', priority: 85, description: 'WIRED' },
  { domain: 'arstechnica.com', category: 'news', priority: 85, description: 'Ars Technica' },
  { domain: 'engadget.com', category: 'news', priority: 80, description: 'Engadget' },
  { domain: 'gizmodo.com', category: 'news', priority: 80, description: 'Gizmodo' },
  { domain: 'mashable.com', category: 'news', priority: 80, description: 'Mashable' },
  { domain: 'recode.net', category: 'news', priority: 75, description: 'Recode' },
  { domain: 'venturebeat.com', category: 'news', priority: 80, description: 'VentureBeat' },
  { domain: 'techrepublic.com', category: 'news', priority: 75, description: 'TechRepublic' },
  { domain: 'zdnet.com', category: 'news', priority: 75, description: 'ZDNet' },
  { domain: 'computerworld.com', category: 'news', priority: 70, description: 'Computerworld' },
  { domain: 'infoworld.com', category: 'news', priority: 70, description: 'InfoWorld' },
  { domain: 'pcworld.com', category: 'news', priority: 70, description: 'PCWorld' },
  { domain: 'macworld.com', category: 'news', priority: 70, description: 'Macworld' },

  // Business News
  { domain: 'forbes.com', category: 'news', priority: 90, description: 'Forbes' },
  { domain: 'fortune.com', category: 'news', priority: 85, description: 'Fortune' },
  { domain: 'businessinsider.com', category: 'news', priority: 85, description: 'Business Insider' },
  { domain: 'cnbc.com', category: 'news', priority: 90, description: 'CNBC' },
  { domain: 'marketwatch.com', category: 'news', priority: 80, description: 'MarketWatch' },
  { domain: 'fool.com', category: 'news', priority: 75, description: 'The Motley Fool' },
  { domain: 'seekingalpha.com', category: 'news', priority: 75, description: 'Seeking Alpha' },
  { domain: 'benzinga.com', category: 'news', priority: 70, description: 'Benzinga' },
  { domain: 'investopedia.com', category: 'news', priority: 80, description: 'Investopedia' },
  { domain: 'barrons.com', category: 'news', priority: 80, description: 'Barron\'s' },
  { domain: 'thestreet.com', category: 'news', priority: 75, description: 'TheStreet' },

  // === SAAS (300+ domains) ===
  // Productivity & Collaboration
  { domain: 'slack.com', category: 'saas', priority: 95, description: 'Slack Team Communication' },
  { domain: 'zoom.us', category: 'saas', priority: 95, description: 'Zoom Video Conferencing' },
  { domain: 'notion.so', category: 'saas', priority: 90, description: 'Notion Productivity' },
  { domain: 'airtable.com', category: 'saas', priority: 85, description: 'Airtable Database' },
  { domain: 'trello.com', category: 'saas', priority: 85, description: 'Trello Project Management' },
  { domain: 'asana.com', category: 'saas', priority: 85, description: 'Asana Task Management' },
  { domain: 'monday.com', category: 'saas', priority: 85, description: 'Monday.com Work OS' },
  { domain: 'clickup.com', category: 'saas', priority: 80, description: 'ClickUp Productivity' },
  { domain: 'basecamp.com', category: 'saas', priority: 80, description: 'Basecamp Project Management' },
  { domain: 'linear.app', category: 'saas', priority: 80, description: 'Linear Issue Tracking' },
  { domain: 'miro.com', category: 'saas', priority: 80, description: 'Miro Collaboration' },
  { domain: 'figma.com', category: 'saas', priority: 90, description: 'Figma Design Tool' },
  { domain: 'canva.com', category: 'saas', priority: 90, description: 'Canva Design Platform' },
  { domain: 'adobe.com/products/creative-cloud', category: 'saas', priority: 90, description: 'Adobe Creative Cloud' },
  { domain: 'sketch.com', category: 'saas', priority: 80, description: 'Sketch Design Tool' },
  { domain: 'invisionapp.com', category: 'saas', priority: 75, description: 'InVision Prototyping' },
  { domain: 'framer.com', category: 'saas', priority: 75, description: 'Framer Design Tool' },

  // CRM & Sales
  { domain: 'salesforce.com', category: 'saas', priority: 100, description: 'Salesforce CRM' },
  { domain: 'hubspot.com', category: 'saas', priority: 90, description: 'HubSpot CRM' },
  { domain: 'pipedrive.com', category: 'saas', priority: 80, description: 'Pipedrive CRM' },
  { domain: 'zendesk.com', category: 'saas', priority: 85, description: 'Zendesk Customer Service' },
  { domain: 'intercom.com', category: 'saas', priority: 85, description: 'Intercom Customer Messaging' },
  { domain: 'freshworks.com', category: 'saas', priority: 80, description: 'Freshworks Suite' },
  { domain: 'zoho.com', category: 'saas', priority: 80, description: 'Zoho Business Suite' },
  { domain: 'mailchimp.com', category: 'saas', priority: 85, description: 'Mailchimp Email Marketing' },
  { domain: 'constantcontact.com', category: 'saas', priority: 75, description: 'Constant Contact' },
  { domain: 'convertkit.com', category: 'saas', priority: 75, description: 'ConvertKit Email Marketing' },
  { domain: 'activecampaign.com', category: 'saas', priority: 75, description: 'ActiveCampaign' },

  // Development Tools
  { domain: 'github.com', category: 'saas', priority: 100, description: 'GitHub Code Repository' },
  { domain: 'gitlab.com', category: 'saas', priority: 85, description: 'GitLab DevOps' },
  { domain: 'bitbucket.org', category: 'saas', priority: 80, description: 'Bitbucket Git Repository' },
  { domain: 'jira.atlassian.com', category: 'saas', priority: 85, description: 'Jira Issue Tracking' },
  { domain: 'confluence.atlassian.com', category: 'saas', priority: 80, description: 'Confluence Wiki' },
  { domain: 'circleci.com', category: 'saas', priority: 75, description: 'CircleCI CI/CD' },
  { domain: 'travis-ci.org', category: 'saas', priority: 70, description: 'Travis CI' },
  { domain: 'jenkins.io', category: 'saas', priority: 75, description: 'Jenkins Automation' },
  { domain: 'docker.com', category: 'saas', priority: 85, description: 'Docker Containers' },
  { domain: 'kubernetes.io', category: 'saas', priority: 80, description: 'Kubernetes Orchestration' },
  { domain: 'terraform.io', category: 'saas', priority: 75, description: 'Terraform Infrastructure' },
  { domain: 'ansible.com', category: 'saas', priority: 75, description: 'Ansible Automation' },

  // Analytics & Data
  { domain: 'google.com/analytics', category: 'saas', priority: 95, description: 'Google Analytics' },
  { domain: 'tableau.com', category: 'saas', priority: 90, description: 'Tableau Analytics' },
  { domain: 'powerbi.microsoft.com', category: 'saas', priority: 90, description: 'Microsoft Power BI' },
  { domain: 'looker.com', category: 'saas', priority: 85, description: 'Looker Data Platform' },
  { domain: 'mixpanel.com', category: 'saas', priority: 80, description: 'Mixpanel Analytics' },
  { domain: 'amplitude.com', category: 'saas', priority: 80, description: 'Amplitude Product Analytics' },
  { domain: 'segment.com', category: 'saas', priority: 80, description: 'Segment Customer Data' },
  { domain: 'hotjar.com', category: 'saas', priority: 75, description: 'Hotjar User Analytics' },
  { domain: 'fullstory.com', category: 'saas', priority: 75, description: 'FullStory Digital Experience' },
  { domain: 'logly.com', category: 'saas', priority: 70, description: 'LogRocket User Experience' },

  // HR & Recruiting
  { domain: 'workday.com', category: 'saas', priority: 90, description: 'Workday HR Platform' },
  { domain: 'bamboohr.com', category: 'saas', priority: 80, description: 'BambooHR' },
  { domain: 'greenhouse.io', category: 'saas', priority: 80, description: 'Greenhouse Recruiting' },
  { domain: 'lever.co', category: 'saas', priority: 75, description: 'Lever Recruiting' },
  { domain: 'jobvite.com', category: 'saas', priority: 75, description: 'Jobvite Talent Acquisition' },
  { domain: 'indeed.com', category: 'saas', priority: 85, description: 'Indeed Job Platform' },
  { domain: 'linkedin.com/talent', category: 'saas', priority: 85, description: 'LinkedIn Talent' },
  { domain: 'glassdoor.com', category: 'saas', priority: 80, description: 'Glassdoor Company Reviews' },
  { domain: 'angel.co', category: 'saas', priority: 75, description: 'AngelList Startup Jobs' },
  { domain: 'upwork.com', category: 'saas', priority: 80, description: 'Upwork Freelance Platform' },
  { domain: 'fiverr.com', category: 'saas', priority: 80, description: 'Fiverr Freelance Services' },
  { domain: 'freelancer.com', category: 'saas', priority: 75, description: 'Freelancer.com' },

  // === CLOUD (200+ domains) ===
  // Major Cloud Providers
  { domain: 'aws.amazon.com', category: 'cloud', priority: 100, description: 'Amazon Web Services' },
  { domain: 'azure.microsoft.com', category: 'cloud', priority: 100, description: 'Microsoft Azure' },
  { domain: 'cloud.google.com', category: 'cloud', priority: 100, description: 'Google Cloud Platform' },
  { domain: 'ibm.com/cloud', category: 'cloud', priority: 90, description: 'IBM Cloud' },
  { domain: 'oracle.com/cloud', category: 'cloud', priority: 90, description: 'Oracle Cloud' },
  { domain: 'alibabacloud.com', category: 'cloud', priority: 85, description: 'Alibaba Cloud' },
  { domain: 'digitalocean.com', category: 'cloud', priority: 85, description: 'DigitalOcean' },
  { domain: 'linode.com', category: 'cloud', priority: 80, description: 'Linode Cloud' },
  { domain: 'vultr.com', category: 'cloud', priority: 75, description: 'Vultr Cloud' },
  { domain: 'rackspace.com', category: 'cloud', priority: 80, description: 'Rackspace Cloud' },
  { domain: 'ovh.com', category: 'cloud', priority: 75, description: 'OVH Cloud' },
  { domain: 'hetzner.com', category: 'cloud', priority: 70, description: 'Hetzner Cloud' },

  // Platform as a Service
  { domain: 'heroku.com', category: 'cloud', priority: 85, description: 'Heroku Platform' },
  { domain: 'vercel.com', category: 'cloud', priority: 85, description: 'Vercel Deployment' },
  { domain: 'netlify.com', category: 'cloud', priority: 85, description: 'Netlify Hosting' },
  { domain: 'railway.app', category: 'cloud', priority: 80, description: 'Railway Cloud' },
  { domain: 'render.com', category: 'cloud', priority: 80, description: 'Render Cloud' },
  { domain: 'fly.io', category: 'cloud', priority: 75, description: 'Fly.io Platform' },
  { domain: 'deta.sh', category: 'cloud', priority: 70, description: 'Deta Cloud' },
  { domain: 'replit.com', category: 'cloud', priority: 80, description: 'Replit Development' },
  { domain: 'glitch.com', category: 'cloud', priority: 75, description: 'Glitch Platform' },
  { domain: 'codesandbox.io', category: 'cloud', priority: 75, description: 'CodeSandbox' },
  { domain: 'stackblitz.com', category: 'cloud', priority: 75, description: 'StackBlitz IDE' },
  { domain: 'gitpod.io', category: 'cloud', priority: 75, description: 'Gitpod Development' },

  // CDN & Edge
  { domain: 'cloudflare.com', category: 'cloud', priority: 90, description: 'Cloudflare CDN' },
  { domain: 'fastly.com', category: 'cloud', priority: 85, description: 'Fastly Edge Cloud' },
  { domain: 'amazonaws.com/cloudfront', category: 'cloud', priority: 85, description: 'Amazon CloudFront' },
  { domain: 'azure.microsoft.com/services/cdn', category: 'cloud', priority: 80, description: 'Azure CDN' },
  { domain: 'keycdn.com', category: 'cloud', priority: 75, description: 'KeyCDN' },
  { domain: 'maxcdn.com', category: 'cloud', priority: 70, description: 'MaxCDN' },
  { domain: 'bunny.net', category: 'cloud', priority: 70, description: 'Bunny CDN' },

  // Database as a Service
  { domain: 'mongodb.com/atlas', category: 'cloud', priority: 85, description: 'MongoDB Atlas' },
  { domain: 'firebase.google.com', category: 'cloud', priority: 85, description: 'Google Firebase' },
  { domain: 'supabase.com', category: 'cloud', priority: 80, description: 'Supabase Database' },
  { domain: 'planetscale.com', category: 'cloud', priority: 80, description: 'PlanetScale MySQL' },
  { domain: 'neon.tech', category: 'cloud', priority: 75, description: 'Neon Postgres' },
  { domain: 'fauna.com', category: 'cloud', priority: 75, description: 'Fauna Database' },
  { domain: 'upstash.com', category: 'cloud', priority: 70, description: 'Upstash Redis' },
  { domain: 'redis.com', category: 'cloud', priority: 80, description: 'Redis Cloud' },
  { domain: 'dynamodb.amazonaws.com', category: 'cloud', priority: 80, description: 'Amazon DynamoDB' },
  { domain: 'cosmosdb.azure.com', category: 'cloud', priority: 75, description: 'Azure Cosmos DB' },

  // Monitoring & Observability
  { domain: 'datadog.com', category: 'cloud', priority: 85, description: 'Datadog Monitoring' },
  { domain: 'newrelic.com', category: 'cloud', priority: 85, description: 'New Relic Observability' },
  { domain: 'splunk.com', category: 'cloud', priority: 80, description: 'Splunk Analytics' },
  { domain: 'sumologic.com', category: 'cloud', priority: 75, description: 'Sumo Logic' },
  { domain: 'loggly.com', category: 'cloud', priority: 70, description: 'Loggly Log Management' },
  { domain: 'papertrailapp.com', category: 'cloud', priority: 70, description: 'Papertrail Logs' },
  { domain: 'sentry.io', category: 'cloud', priority: 80, description: 'Sentry Error Monitoring' },
  { domain: 'rollbar.com', category: 'cloud', priority: 75, description: 'Rollbar Error Tracking' },
  { domain: 'bugsnag.com', category: 'cloud', priority: 70, description: 'Bugsnag Error Monitoring' },

  // === WEB3 (200+ domains) ===
  // Major Exchanges
  { domain: 'binance.com', category: 'web3', priority: 100, description: 'Binance Exchange' },
  { domain: 'coinbase.com', category: 'web3', priority: 100, description: 'Coinbase Exchange' },
  { domain: 'kraken.com', category: 'web3', priority: 95, description: 'Kraken Exchange' },
  { domain: 'gemini.com', category: 'web3', priority: 90, description: 'Gemini Exchange' },
  { domain: 'crypto.com', category: 'web3', priority: 90, description: 'Crypto.com' },
  { domain: 'kucoin.com', category: 'web3', priority: 85, description: 'KuCoin Exchange' },
  { domain: 'huobi.com', category: 'web3', priority: 85, description: 'Huobi Exchange' },
  { domain: 'okx.com', category: 'web3', priority: 85, description: 'OKX Exchange' },
  { domain: 'bybit.com', category: 'web3', priority: 80, description: 'Bybit Exchange' },
  { domain: 'gate.io', category: 'web3', priority: 80, description: 'Gate.io Exchange' },
  { domain: 'mexc.com', category: 'web3', priority: 75, description: 'MEXC Exchange' },
  { domain: 'bitfinex.com', category: 'web3', priority: 80, description: 'Bitfinex Exchange' },
  { domain: 'bitstamp.net', category: 'web3', priority: 75, description: 'Bitstamp Exchange' },

  // DeFi Protocols
  { domain: 'uniswap.org', category: 'web3', priority: 95, description: 'Uniswap DEX' },
  { domain: 'pancakeswap.finance', category: 'web3', priority: 90, description: 'PancakeSwap DEX' },
  { domain: 'sushiswap.com', category: 'web3', priority: 85, description: 'SushiSwap DEX' },
  { domain: 'compound.finance', category: 'web3', priority: 85, description: 'Compound Finance' },
  { domain: 'aave.com', category: 'web3', priority: 90, description: 'Aave Protocol' },
  { domain: 'makerdao.com', category: 'web3', priority: 85, description: 'MakerDAO' },
  { domain: 'curve.fi', category: 'web3', priority: 85, description: 'Curve Finance' },
  { domain: 'yearn.finance', category: 'web3', priority: 80, description: 'Yearn Finance' },
  { domain: 'synthetix.io', category: 'web3', priority: 80, description: 'Synthetix' },
  { domain: '1inch.io', category: 'web3', priority: 80, description: '1inch DEX Aggregator' },
  { domain: 'balancer.fi', category: 'web3', priority: 75, description: 'Balancer Protocol' },
  { domain: 'convex.finance', category: 'web3', priority: 75, description: 'Convex Finance' },

  // NFT Marketplaces
  { domain: 'opensea.io', category: 'web3', priority: 95, description: 'OpenSea NFT Marketplace' },
  { domain: 'rarible.com', category: 'web3', priority: 85, description: 'Rarible NFT Marketplace' },
  { domain: 'foundation.app', category: 'web3', priority: 80, description: 'Foundation NFT' },
  { domain: 'superrare.com', category: 'web3', priority: 80, description: 'SuperRare NFT' },
  { domain: 'niftygateway.com', category: 'web3', priority: 80, description: 'Nifty Gateway' },
  { domain: 'async.art', category: 'web3', priority: 75, description: 'Async Art NFT' },
  { domain: 'knownorigin.io', category: 'web3', priority: 70, description: 'KnownOrigin NFT' },
  { domain: 'makersplace.com', category: 'web3', priority: 75, description: 'MakersPlace NFT' },
  { domain: 'hicetnunc.art', category: 'web3', priority: 70, description: 'Hic et Nunc NFT' },
  { domain: 'atomicmarket.io', category: 'web3', priority: 70, description: 'AtomicMarket NFT' },

  // Blockchain Networks
  { domain: 'ethereum.org', category: 'web3', priority: 100, description: 'Ethereum Network' },
  { domain: 'bitcoin.org', category: 'web3', priority: 100, description: 'Bitcoin Network' },
  { domain: 'binance.org', category: 'web3', priority: 90, description: 'Binance Smart Chain' },
  { domain: 'polygon.technology', category: 'web3', priority: 90, description: 'Polygon Network' },
  { domain: 'solana.com', category: 'web3', priority: 90, description: 'Solana Network' },
  { domain: 'cardano.org', category: 'web3', priority: 85, description: 'Cardano Network' },
  { domain: 'polkadot.network', category: 'web3', priority: 85, description: 'Polkadot Network' },
  { domain: 'cosmos.network', category: 'web3', priority: 80, description: 'Cosmos Network' },
  { domain: 'avalanche.io', category: 'web3', priority: 80, description: 'Avalanche Network' },
  { domain: 'near.org', category: 'web3', priority: 75, description: 'NEAR Protocol' },
  { domain: 'algorand.com', category: 'web3', priority: 75, description: 'Algorand Network' },
  { domain: 'tezos.com', category: 'web3', priority: 70, description: 'Tezos Network' },

  // Web3 Infrastructure
  { domain: 'metamask.io', category: 'web3', priority: 95, description: 'MetaMask Wallet' },
  { domain: 'walletconnect.com', category: 'web3', priority: 85, description: 'WalletConnect Protocol' },
  { domain: 'infura.io', category: 'web3', priority: 90, description: 'Infura Infrastructure' },
  { domain: 'alchemy.com', category: 'web3', priority: 90, description: 'Alchemy Platform' },
  { domain: 'moralis.io', category: 'web3', priority: 80, description: 'Moralis Web3 Development' },
  { domain: 'thegraph.com', category: 'web3', priority: 85, description: 'The Graph Protocol' },
  { domain: 'chainlink.com', category: 'web3', priority: 90, description: 'Chainlink Oracles' },
  { domain: 'ipfs.io', category: 'web3', priority: 85, description: 'IPFS Storage' },
  { domain: 'filecoin.io', category: 'web3', priority: 80, description: 'Filecoin Storage' },
  { domain: 'arweave.org', category: 'web3', priority: 75, description: 'Arweave Storage' },

  // Web3 Tools & Analytics
  { domain: 'etherscan.io', category: 'web3', priority: 90, description: 'Etherscan Explorer' },
  { domain: 'bscscan.com', category: 'web3', priority: 85, description: 'BSC Explorer' },
  { domain: 'polygonscan.com', category: 'web3', priority: 85, description: 'Polygon Explorer' },
  { domain: 'solscan.io', category: 'web3', priority: 80, description: 'Solana Explorer' },
  { domain: 'coinmarketcap.com', category: 'web3', priority: 95, description: 'CoinMarketCap' },
  { domain: 'coingecko.com', category: 'web3', priority: 95, description: 'CoinGecko' },
  { domain: 'yahootoken.com', category: 'web3', priority: 98, description: 'Yahoo Token (YHT) Official Website' },
  { domain: 'yahootoken.live', category: 'web3', priority: 90, description: 'Yahoo Token Live Platform' },
  { domain: 'poocoin.app', category: 'web3', priority: 85, description: 'PooCoin DEX Charts & Analytics' },
  { domain: 'dextools.io', category: 'web3', priority: 80, description: 'DEXTools Analytics' },
  { domain: 'dune.com', category: 'web3', priority: 85, description: 'Dune Analytics' },
  { domain: 'messari.io', category: 'web3', priority: 80, description: 'Messari Crypto Research' },
  { domain: 'defipulse.com', category: 'web3', priority: 80, description: 'DeFi Pulse' },
  { domain: 'defirate.com', category: 'web3', priority: 75, description: 'DeFi Rate' },
  { domain: 'coindesk.com', category: 'web3', priority: 85, description: 'CoinDesk News' },
  { domain: 'cointelegraph.com', category: 'web3', priority: 80, description: 'Cointelegraph News' },
  { domain: 'decrypt.co', category: 'web3', priority: 75, description: 'Decrypt News' },
  { domain: 'theblock.co', category: 'web3', priority: 80, description: 'The Block News' },
];

export class DomainSeeder {
  private storage = storage;
  private seedDomains = SEED_DOMAINS;

  constructor() {
    console.log(`🌱 Domain Seeder initialized with ${this.seedDomains.length} domains`);
  }

  /**
   * Seed all domains into the database
   */
  async seedAllDomains(): Promise<{
    created: number;
    skipped: number;
    errors: number;
    categories: Record<string, number>;
  }> {
    console.log('🌱 Starting domain seeding process...');
    
    const stats = {
      created: 0,
      skipped: 0,
      errors: 0,
      categories: {} as Record<string, number>
    };

    for (const domainSeed of this.seedDomains) {
      try {
        // Check if domain already exists
        const existing = await this.storage.getDomain(domainSeed.domain);
        if (existing) {
          stats.skipped++;
          continue;
        }

        // Create new domain
        const domainData: InsertDomain = {
          domain: domainSeed.domain,
          status: 'pending',
          priority: domainSeed.priority,
          crawlDelayMs: 1000, // Default 1 second delay
        };

        await this.storage.createDomain(domainData);
        
        stats.created++;
        
        // Track category stats
        const category = domainSeed.category;
        stats.categories[category] = (stats.categories[category] || 0) + 1;

        if (stats.created % 100 === 0) {
          console.log(`🌱 Seeded ${stats.created} domains so far...`);
        }

      } catch (error) {
        console.error(`❌ Failed to seed domain ${domainSeed.domain}:`, error instanceof Error ? error.message : String(error));
        stats.errors++;
      }
    }

    console.log('🌱 Domain seeding completed!');
    console.log(`✅ Created: ${stats.created}`);
    console.log(`⏭️ Skipped: ${stats.skipped}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log('📊 By Category:', stats.categories);

    return stats;
  }

  /**
   * Seed domains for specific category
   */
  async seedCategory(category: string): Promise<number> {
    console.log(`🌱 Seeding domains for category: ${category}`);
    
    const categoryDomains = this.seedDomains.filter(d => d.category === category);
    let created = 0;

    for (const domainSeed of categoryDomains) {
      try {
        const existing = await this.storage.getDomain(domainSeed.domain);
        if (existing) continue;

        const domainData: InsertDomain = {
          domain: domainSeed.domain,
          status: 'pending',
          priority: domainSeed.priority,
          crawlDelayMs: 1000,
        };

        await this.storage.createDomain(domainData);
        created++;

      } catch (error) {
        console.error(`❌ Failed to seed domain ${domainSeed.domain}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log(`✅ Seeded ${created} domains for category ${category}`);
    return created;
  }

  /**
   * Add initial crawl queue entries for all domains
   */
  async queueHomepages(): Promise<{
    queued: number;
    errors: number;
  }> {
    console.log('🚀 Queueing homepage URLs for all domains...');
    
    const stats = {
      queued: 0,
      errors: 0
    };

    // Get all pending domains
    const domains = await this.storage.listDomains('pending', 10000);
    
    for (const domain of domains) {
      try {
        // Queue the homepage URL
        await this.storage.addToCrawlQueue({
          domainId: domain.id!,
          url: `https://${domain.domain}`,
          priority: domain.priority || 50,
          reason: 'seed'
        });

        stats.queued++;

        if (stats.queued % 100 === 0) {
          console.log(`🚀 Queued ${stats.queued} homepage URLs so far...`);
        }

      } catch (error) {
        console.error(`❌ Failed to queue homepage for ${domain.domain}:`, error instanceof Error ? error.message : String(error));
        stats.errors++;
      }
    }

    console.log('🚀 Homepage queueing completed!');
    console.log(`✅ Queued: ${stats.queued}`);
    console.log(`❌ Errors: ${stats.errors}`);

    return stats;
  }

  /**
   * Get seeding statistics
   */
  getStats(): {
    totalDomains: number;
    byCategory: Record<string, number>;
    priorityDistribution: Record<string, number>;
  } {
    const stats = {
      totalDomains: this.seedDomains.length,
      byCategory: {} as Record<string, number>,
      priorityDistribution: {} as Record<string, number>
    };

    for (const domain of this.seedDomains) {
      // Category stats
      stats.byCategory[domain.category] = (stats.byCategory[domain.category] || 0) + 1;
      
      // Priority distribution
      const priorityRange = domain.priority >= 90 ? '90-100' : 
                            domain.priority >= 80 ? '80-89' :
                            domain.priority >= 70 ? '70-79' :
                            domain.priority >= 60 ? '60-69' : '50-59';
      stats.priorityDistribution[priorityRange] = (stats.priorityDistribution[priorityRange] || 0) + 1;
    }

    return stats;
  }

  /**
   * Run full seeding process
   */
  async runFullSeed(): Promise<void> {
    console.log('🌟 Starting full domain seeding process...');
    
    // 1. Seed all domains
    const seedStats = await this.seedAllDomains();
    
    // 2. Queue homepages if we created new domains
    if (seedStats.created > 0) {
      await this.queueHomepages();
    }
    
    console.log('🌟 Full domain seeding process completed!');
  }
}

export const domainSeeder = new DomainSeeder();