import { fetchText } from '@libs/fetch';
import { Plugin } from '@typings/plugin';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';
import dayjs from 'dayjs';

// Helper function to parse the data-page JSON
const getPageProps = async (url: string) => {
  const result = await fetchText(url);
  const cheerio = loadCheerio(result);
  const jsonData = cheerio('div#app').attr('data-page');
  if (!jsonData) {
    throw new Error(`Failed to find data-page attribute on ${url}`);
  }
  try {
    return JSON.parse(jsonData).props;
  } catch (e) {
    throw new Error(`Failed to parse JSON from data-page on ${url}: ${e}`);
  }
};

// Helper function to sanitize cover URLs
const sanitizeCoverUrl = (site: string, coverUrl?: string | null): string => {
  if (!coverUrl) return defaultCover;
  if (coverUrl.startsWith('//')) {
    return 'https:' + coverUrl;
  }
  if (coverUrl.startsWith('/')) {
    // Ensure it's not already a full URL if site also ends with / and path starts with /
    if (coverUrl.startsWith(site)) return coverUrl;
    return site + coverUrl;
  }
  if (coverUrl.startsWith('http')) {
    return coverUrl;
  }
  return defaultCover;
};

// Hardcoded genres based on browse_all__page.html -> props.genres
const genresList = [
  { label: 'Action', value: 'action' },
  { label: 'Adult', value: 'adult' },
  { label: 'Adventure', value: 'adventure' },
  { label: 'Comedy', value: 'comedy' },
  { label: 'Drama', value: 'drama' },
  { label: 'Ecchi', value: 'ecchi' },
  { label: 'Fantasy', value: 'fantasy' },
  { label: 'Gender Bender', value: 'gender-bender' },
  { label: 'Harem', value: 'harem' },
  { label: 'Historical', value: 'historical' },
  { label: 'Horror', value: 'horror' },
  { label: 'Josei', value: 'josei' },
  { label: 'Martial Arts', value: 'martial-arts' },
  { label: 'Mature', value: 'mature' },
  { label: 'Mecha', value: 'mecha' },
  { label: 'Mystery', value: 'mystery' },
  { label: 'Psychological', value: 'psychological' },
  { label: 'Romance', value: 'romance' },
  { label: 'School Life', value: 'school-life' },
  { label: 'Sci-fi', value: 'sci-fi' },
  { label: 'Seinen', value: 'seinen' },
  { label: 'Shoujo', value: 'shoujo' },
  { label: 'Shoujo Ai', value: 'shoujo-ai' },
  { label: 'Shounen', value: 'shounen' },
  { label: 'Shounen Ai', value: 'shounen-ai' },
  { label: 'Slice of Life', value: 'slice-of-life' },
  { label: 'Smut', value: 'smut' },
  { label: 'Sports', value: 'sports' },
  { label: 'Supernatural', value: 'supernatural' },
  { label: 'Tragedy', value: 'tragedy' },
  { label: 'Wuxia', value: 'wuxia' },
  { label: 'Xianxia', value: 'xianxia' },
  { label: 'Xuanhuan', value: 'xuanhuan' },
  { label: 'Yaoi', value: 'yaoi' },
  { label: 'Yuri', value: 'yuri' },
];

const tagsList = [
  { label: 'Academy', value: 'academy' },
  { label: 'Cultivation', value: 'cultivation' },
  { label: 'Reincarnation', value: 'reincarnation' },
  { label: 'Transmigration', value: 'transmigration' },
  { label: 'System', value: 'game-elements' },
  { label: 'Weak to Strong', value: 'weak-to-strong' },
  { label: 'Overpowered Protagonist', value: 'overpowered-protagonist' },
  { label: 'Male Protagonist', value: 'male-protagonist' },
  { label: 'Female Protagonist', value: 'female-protagonist' },
  { label: 'Villainess', value: 'villainess-noble-girls'},
];


class DarkStarTranslationsPlugin implements Plugin.PluginBase {
  id = 'darkstartranslations';
  name = 'DarkStar Translations';
  icon = 'src/en/darkstartranslations/icon.png';
  site = 'https://darkstartranslations.com';
  version = '1.0.0';

  filters: Filters = {
    sortBy: {
      label: 'Sort By',
      value: 'updated|desc', // Corrected default value
      options: [
        { label: 'Recently Updated', value: 'updated|desc' }, // Corrected value
        { label: 'Most Popular', value: 'bookmarks_count|desc' },
        { label: 'A-Z', value: 'title|asc' },
        { label: 'Z-A', value: 'title|desc' },
        { label: 'Newest', value: 'created_at|desc' },
        { label: 'Oldest', value: 'created_at|asc' },
      ],
      type: FilterTypes.Picker,
    },
    genres: {
      label: 'Genres',
      value: [],
      options: genresList,
      type: FilterTypes.CheckboxGroup,
    },
    tags: {
      label: 'Tags',
      value: [],
      options: tagsList,
      type: FilterTypes.CheckboxGroup,
    }
  } satisfies Filters;
  
  resolveUrl = (path: string) => this.site + path;

  async popularNovels(
    pageNo: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];

    if (showLatestNovels) {
      const props = await getPageProps(this.site);
      const latestUpdates = props.latestUpdates?.data;

      if (latestUpdates && Array.isArray(latestUpdates)) {
        latestUpdates.forEach((item: any) => {
          if (item.series_slug && item.title) {
            novels.push({
              name: item.title,
              path: `/series/${item.series_slug}`,
              cover: sanitizeCoverUrl(this.site, item.coverImage),
            });
          }
        });
      }
    } else {
      let url = `${this.site}/series?page=${pageNo}`;
      if (filters) {
        const { sortBy, genres, tags } = filters;
        if (sortBy?.value) {
          const [sortParam, orderParam] = (sortBy.value as string).split('|');
          url += `&sort=${sortParam}&order=${orderParam}`;
        }
        if (genres?.value?.length) {
          url += `&genres=${(genres.value as string[]).join(',')}`;
        }
        if (tags?.value?.length) {
          url += `&tags=${(tags.value as string[]).join(',')}`;
        }
      }
      
      const props = await getPageProps(url);
      const seriesList = props.seriesList?.data;

      if (seriesList && Array.isArray(seriesList)) {
        seriesList.forEach((item: any) => {
          if (item.slug && item.title) {
            novels.push({
              name: item.title,
              path: `/series/${item.slug}`,
              cover: sanitizeCoverUrl(this.site, item.cover?.thumbnail_url || item.cover?.url || item.coverImage),
            });
          }
        });
      }
    }
    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const props = await getPageProps(this.site + novelPath);
    const series = props.series;

    if (!series) {
      throw new Error(`Failed to parse novel data for ${novelPath}`);
    }

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: series.title || 'Untitled',
      cover: sanitizeCoverUrl(this.site, series.cover?.url || series.coverImage),
      summary: series.description ? loadCheerio(series.description).text() : '', // Basic HTML removal
      author: (series.user?.name === 'DarkStarTL' || series.user?.name === 'GalaxyTL') ? 'DarkStar Translations' : series.user?.name || 'Unknown',
      artist: null,
      status: this.mapNovelStatus(series.story_state),
      genres: series.genres?.map((g: any) => g.name).join(', ') || '',
    };

    const chapters: Plugin.ChapterItem[] = [];
    if (series.chapters && Array.isArray(series.chapters)) {
      series.chapters.forEach((ch: any) => {
        if (ch.slug && (ch.name || ch.title || ch.number)) {
          chapters.push({
            name: ch.name || ch.title || `Chapter ${ch.number}`,
            path: `/series/${series.slug}/${ch.slug}`,
            releaseTime: ch.created_at ? dayjs(ch.created_at).format('YYYY-MM-DD HH:mm') : null,
            chapterNumber: typeof ch.number === 'number' ? ch.number : undefined,
          });
        }
      });
    }
    
    novel.chapters = chapters.reverse(); 

    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const props = await getPageProps(this.site + chapterPath);
    const chapter = props.chapter;

    if (!chapter || !chapter.content) {
      throw new Error(`Failed to parse chapter content for ${chapterPath}`);
    }
    // Remove potential ad divs added by the site within chapter content
    const $ = loadCheerio(chapter.content);
    $('div.ad-container').remove();
    return $.html();
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}/series?page=${pageNo}&search=${encodeURIComponent(
      searchTerm,
    )}`;
    const props = await getPageProps(url);
    const novels: Plugin.NovelItem[] = [];
    const seriesList = props.seriesList?.data;

    if (seriesList && Array.isArray(seriesList)) {
      seriesList.forEach((item: any) => {
        if (item.slug && item.title) {
          novels.push({
            name: item.title,
            path: `/series/${item.slug}`,
            cover: sanitizeCoverUrl(this.site, item.cover?.thumbnail_url || item.cover?.url || item.coverImage),
          });
        }
      });
    }
    return novels;
  }

  private mapNovelStatus = (status?: string): NovelStatus => {
    switch (status?.toLowerCase()) {
      case 'ongoing':
        return NovelStatus.Ongoing;
      case 'completed':
      case 'end': // As seen in "I Reincarnated into a Game Filled with Mods"
        return NovelStatus.Completed;
      case 'hiatus':
        return NovelStatus.OnHiatus;
      case 'dropped':
      case 'cancelled':
        return NovelStatus.Cancelled;
      default:
        return NovelStatus.Unknown;
    }
  };
}

export default new DarkStarTranslationsPlugin();
