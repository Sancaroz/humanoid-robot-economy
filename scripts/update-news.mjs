import { writeFile } from 'node:fs/promises';

const NEWS_SOURCES = [
  {
    company: 'Tesla',
    url: 'https://news.google.com/rss/search?q=Tesla+Optimus+robot&hl=en-US&gl=US&ceid=US:en',
  },
  {
    company: 'OpenAI',
    url: 'https://news.google.com/rss/search?q=OpenAI+robotics+news&hl=en-US&gl=US&ceid=US:en',
  },
  {
    company: 'Figure AI',
    url: 'https://news.google.com/rss/search?q=Figure+AI+humanoid+robot&hl=en-US&gl=US&ceid=US:en',
  },
  {
    company: 'Unitree',
    url: 'https://news.google.com/rss/search?q=Unitree+humanoid+robot&hl=en-US&gl=US&ceid=US:en',
  },
  {
    company: 'Boston Dynamics',
    url: 'https://news.google.com/rss/search?q=Boston+Dynamics+Atlas+news&hl=en-US&gl=US&ceid=US:en',
  },
  {
    company: 'Agility Robotics',
    url: 'https://news.google.com/rss/search?q=Agility+Robotics+Digit+news&hl=en-US&gl=US&ceid=US:en',
  },
];

const MAX_ITEMS_PER_SOURCE = 4;
const MAX_TOTAL_ITEMS = 24;

function decodeEntities(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function extractTag(block, tag) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(regex);
  return match ? decodeEntities(match[1]) : '';
}

function parseRssItems(xmlText, company) {
  const items = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return items
    .slice(0, MAX_ITEMS_PER_SOURCE)
    .map((itemBlock) => {
      const title = extractTag(itemBlock, 'title');
      const link = extractTag(itemBlock, 'link');
      const pubDate = extractTag(itemBlock, 'pubDate');

      if (!title || !link) {
        return null;
      }

      return {
        company,
        title,
        link,
        pubDate,
      };
    })
    .filter(Boolean);
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      'User-Agent': 'RoboLogAI-News-Bot/1.0',
      Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.company}: ${response.status}`);
  }

  const xmlText = await response.text();
  return parseRssItems(xmlText, source.company);
}

async function main() {
  const settled = await Promise.allSettled(NEWS_SOURCES.map(fetchSource));

  const items = settled
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, MAX_TOTAL_ITEMS);

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceCount: NEWS_SOURCES.length,
    itemCount: items.length,
    items,
  };

  await writeFile('data/news.json', JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`news.json updated with ${items.length} items`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
