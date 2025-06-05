import { fetchText } from '@libs/fetch';
import { Plugin } from '@typings/plugin';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';
import dayjs from 'dayjs';

// Helper function to parse the data-page JSON (still needed for main novel details)
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
    return site + coverUrl;
  }
  if (coverUrl.startsWith('http')) {
    return coverUrl;
  }
  return defaultCover;
};

const genresList = [
  { label: 'Action', value: 'action' }, { label: 'Adult', value: 'adult' },
  { label: 'Adventure', value: 'adventure' }, { label: 'Comedy', value: 'comedy' },
  { label: 'Drama', value: 'drama' }, { label: 'Ecchi', value: 'ecchi' },
  { label: 'Fantasy', value: 'fantasy' }, { label: 'Gender Bender', value: 'gender-bender' },
  { label: 'Harem', value: 'harem' }, { label: 'Historical', value: 'historical' },
  { label: 'Horror', value: 'horror' }, { label: 'Josei', value: 'josei' },
  { label: 'Martial Arts', value: 'martial-arts' }, { label: 'Mature', value: 'mature' },
  { label: 'Mecha', value: 'mecha' }, { label: 'Mystery', value: 'mystery' },
  { label: 'Psychological', value: 'psychological' }, { label: 'Romance', value: 'romance' },
  { label: 'School Life', value: 'school-life' }, { label: 'Sci-fi', value: 'sci-fi' },
  { label: 'Seinen', value: 'seinen' }, { label: 'Shoujo', value: 'shoujo' },
  { label: 'Shoujo Ai', value: 'shoujo-ai' }, { label: 'Shounen', value: 'shounen' },
  { label: 'Shounen Ai', value: 'shounen-ai' }, { label: 'Slice of Life', value: 'slice-of-life' },
  { label: 'Smut', value: 'smut' }, { label: 'Sports', value: 'sports' },
  { label: 'Supernatural', value: 'supernatural' }, { label: 'Tragedy', value: 'tragedy' },
  { label: 'Wuxia', value: 'wuxia' }, { label: 'Xianxia', value: 'xianxia' },
  { label: 'Xuanhuan', value: 'xuanhuan' }, { label: 'Yaoi', value: 'yaoi' },
  { label: 'Yuri', value: 'yuri' },
];

const tagsList = [
  { label: 'Academy', value: 'academy' }, { label: 'Cultivation', value: 'cultivation' },
  { label: 'Reincarnation', value: 'reincarnation' }, { label: 'Transmigration', value: 'transmigration' },
  { label: 'System', value: 'game-elements' }, { label: 'Weak to Strong', value: 'weak-to-strong' },
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
  version = '1.0.2'; // Incremented patch version for new chapter fetching logic

  filters: Filters = {
    sortBy: {
      label: 'Sort By',
      value: 'updated|desc', 
      options: [
        { label: 'Recently Updated', value: 'updated|desc' }, 
        { label: 'A-Z', value: 'title|asc' },
        { label: 'Z-A', value: 'title|desc' },
        { label: 'Newest', value: 'new|desc' },
        { label: 'Oldest', value: 'new|asc' },
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
  
  resolveUrl = (path: string) => {
    if (path.startsWith('http')) {
      return path;
    }
    return this.site + path;
  }

  async popularNovels(
    pageNo: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];
    let url = ''; 

    if (showLatestNovels) {
      url = `${this.site}/series?order=desc&page=${pageNo}&sort=new`;
      const props = await getPageProps(url);
      const seriesList = props.seriesList?.data;

      if (seriesList && Array.isArray(seriesList)) {
        seriesList.forEach((item: any) => {
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
      url = `${this.site}/series?`; 
      
      const activeFilters = filters || this.filters; 

      if (activeFilters.sortBy?.value) {
        const [sortParam, orderParam] = (activeFilters.sortBy.value as string).split('|');
        url += `order=${orderParam}&page=${pageNo}&sort=${sortParam}`;
      }
      if (activeFilters.genres?.value?.length) {
        url += `&genres=${(activeFilters.genres.value as string[]).join(',')}`;
      }
      if (activeFilters.tags?.value?.length) {
        url += `&tags=${(activeFilters.tags.value as string[]).join(',')}`;
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
    // Step 1: Get novel details from the main page
    const initialProps = await getPageProps(this.site + novelPath);
    const series = initialProps.series;

    if (!series || !series.slug) {
      throw new Error(`Failed to parse novel data or series slug for ${novelPath}`);
    }

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: series.title || 'Untitled',
      cover: sanitizeCoverUrl(this.site, series.cover?.url || series.coverImage),
      summary: series.description ? loadCheerio(series.description).text() : '',
      author: (series.user?.name === 'DarkStarTL' || series.user?.name === 'GalaxyTL') ? 'DarkStar Translations' : series.user?.name || 'Unknown',
      artist: null,
      status: this.mapNovelStatus(series.story_state),
      genres: series.genres?.map((g: any) => g.name).join(', ') || '',
    };

    // Step 2: Fetch all chapters from the dedicated API endpoint
    // novelPath is like /series/series-name, which is what we need for the API
    const chaptersAPIUrl = `${this.site}${novelPath}/chapters?sort_order=desc`;
    const chaptersJsonText = await fetchText(chaptersAPIUrl);
    const chaptersData = JSON.parse(chaptersJsonText);

    const chapters: Plugin.ChapterItem[] = [];
    if (chaptersData && chaptersData.chapters && Array.isArray(chaptersData.chapters)) {
      chaptersData.chapters.forEach((ch: any) => {
        if (ch.slug && (ch.name || ch.title || ch.number)) {
          let chapterName = ch.name || ch.title || `Chapter ${ch.number}`;
          // Add lock emoji if chapter is premium
          if (ch.is_premium === true) {
            chapterName = '🔒 ' + chapterName;
          }

          chapters.push({
            name: chapterName,
            // Use the 'slug' from the API for the chapter path, as it's more reliable
            path: `/series/${series.slug}/${ch.slug}`,
            releaseTime: ch.created_at ? dayjs(ch.created_at).format('YYYY-MM-DD HH:mm') : null,
            chapterNumber: typeof ch.number === 'number' ? ch.number : undefined,
          });
        }
      });
    }
    
    // The API returns chapters in descending order (latest first, e.g., 284, 283, ...).
    // To store them in chronological order (oldest first, e.g., 1, 2, ...), we reverse the list.
    novel.chapters = chapters.reverse(); 

    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const props = await getPageProps(this.site + chapterPath);
    const chapter = props.chapter;

    if (!chapter || !chapter.content) {
      throw new Error(`Failed to parse chapter content for ${chapterPath}`);
    }
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
      case 'end': 
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
