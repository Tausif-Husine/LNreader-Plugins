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
  version = '1.0.1'; // Incremented patch version

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
    const props = await getPageProps(this.site + novelPath);
    const series = props.series;

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

    const chapters: Plugin.ChapterItem[] = [];
    const existingChaptersMap = new Map<number, any>();
    let maxChapterNumber = 0;

    // Process chapters provided by the server to find the max chapter number
    // and store existing chapter data (name, actual slug, release time).
    if (series.chapters && Array.isArray(series.chapters)) {
      series.chapters.forEach((ch: any) => {
        if (typeof ch.number === 'number' && ch.slug) {
          existingChaptersMap.set(ch.number, ch);
          if (ch.number > maxChapterNumber) {
            maxChapterNumber = ch.number;
          }
        }
      });
    }

    // If chapters were found (i.e., maxChapterNumber > 0), generate the full list.
    if (maxChapterNumber > 0) {
      for (let i = 1; i <= maxChapterNumber; i++) {
        const existingChapterData = existingChaptersMap.get(i);
        if (existingChapterData) {
          // This chapter was in the initial data load. Use its details.
          const ch = existingChapterData;
          chapters.push({
            name: ch.name || ch.title || `Chapter ${ch.number}`,
            // Path is constructed using ch.number based on site's URL structure
            path: `/series/${series.slug}/${ch.number}`, 
            releaseTime: ch.created_at ? dayjs(ch.created_at).format('YYYY-MM-DD HH:mm') : null,
            chapterNumber: ch.number,
          });
        } else {
          // This chapter was not in the initial data (it's an older one).
          // Create a placeholder, assuming its path can be formed with the chapter number.
          chapters.push({
            name: `Chapter ${i}`,
            path: `/series/${series.slug}/${i}`,
            releaseTime: null, // Release time is unknown for these inferred chapters
            chapterNumber: i,
          });
        }
      }
    }
    
    // Chapters are generated in ascending order (1, 2, ..., N).
    // Reversing them makes the list (N, ..., 2, 1), common for display (latest first).
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
    $('div.ad-container').remove(); // Remove ad containers
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
