import { fetchApi } from '@libs/fetch';
import { Plugin } from '@typings/plugin';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { load as loadCheerio, CheerioAPI } from 'cheerio';
import { NovelStatus } from '@libs/novelStatus';
import { storage } from '@libs/storage';

class MzNovelsPlugin implements Plugin.PluginBase {
  id = 'mznovels';
  name = 'MzNovels';
  icon = 'src/en/mznovels/icon.png';
  site = 'https://mznovels.com';
  version = '1.0.0';

  customUserAgent: string;
  pluginSettings: Plugin.PluginSettings;

  constructor() {
    this.customUserAgent = storage.get('mznovels_user_agent') || '';
    this.pluginSettings = {
      customUserAgent: {
        label: 'Custom User-Agent (leave empty for default)',
        value: this.customUserAgent,
        type: 'TextInput',
      },
    };
  }

  private getRequestInit(): RequestInit {
    if (this.customUserAgent) {
      return {
        headers: {
          'User-Agent': this.customUserAgent,
        },
      };
    }
    return {};
  }

  filters: Filters = {
    sort_by: {
      label: 'Sort By',
      value: 'date',
      type: FilterTypes.Picker,
      options: [
        { label: 'Relevance', value: 'relevance' },
        { label: 'Date Updated', value: 'date' },
        { label: 'Number of Views', value: 'views' },
        { label: 'Number of Favorites', value: 'favorites' },
        { label: 'Number of Bookmarks', value: 'bookmarks' },
      ],
    },
    sort_order: {
      label: 'Sort Order',
      value: 'desc',
      type: FilterTypes.Picker,
      options: [
        { label: 'Descending', value: 'desc' },
        { label: 'Ascending', value: 'asc' },
      ],
    },
    status_filter: {
      label: 'Story Status',
      value: 'all',
      type: FilterTypes.Picker,
      options: [
        { label: 'All Statuses', value: 'all' },
        { label: 'Ongoing Only', value: 'ongoing' },
        { label: 'Completed Only', value: 'completed' },
      ],
    },
    story_origin: {
      label: 'Story Origin',
      value: 'all',
      type: FilterTypes.Picker,
      options: [
        { label: 'All Origins', value: 'all' },
        { label: 'Original', value: 'original' },
        { label: 'Fanfiction', value: 'fanfiction' },
      ],
    },
    genre_logic: {
      label: 'Genre Logic (for included)',
      value: 'AND',
      type: FilterTypes.Picker,
      options: [
        { label: 'AND', value: 'AND' },
        { label: 'OR', value: 'OR' },
      ],
    },
    genres: {
      label: 'Genres',
      value: { included: [], excluded: [] },
      type: FilterTypes.ExcludableCheckboxGroup,
      options: [
        { label: 'Action', value: '1' },
        { label: 'Adult', value: '2' },
        { label: 'Adventure', value: '3' },
        { label: 'Comedy', value: '4' },
        { label: 'Doujinshi', value: '5' },
        { label: 'Drama', value: '6' },
        { label: 'Ecchi', value: '7' },
        { label: 'Fantasy', value: '8' },
        { label: 'Gender Bender', value: '9' },
        { label: 'Harem', value: '10' },
        { label: 'Historical', value: '11' },
        { label: 'Horror', value: '12' },
        { label: 'Isekai', value: '13' },
        { label: 'Josei', value: '14' },
        { label: 'Martial Arts', value: '15' },
        { label: 'Mecha', value: '16' },
        { label: 'Mystery', value: '17' },
        { label: 'Psychological', value: '18' },
        { label: 'Romance', value: '19' },
        { label: 'School Life', value: '20' },
        { label: 'Sci-fi', value: '21' },
        { label: 'Seinen', value: '22' },
        { label: 'Shoujo', value: '23' },
        { label: 'Shounen', value: '24' },
        { label: 'Slice of Life', value: '25' },
        { label: 'Smut', value: '26' },
        { label: 'Sports', value: '27' },
        { label: 'Supernatural', value: '28' },
        { label: 'Tragedy', value: '29' },
        { label: 'Yaoi', value: '30' },
        { label: 'Yuri', value: '31' },
      ],
    },
    story_type_logic: {
      label: 'Content Logic',
      value: 'OR',
      type: FilterTypes.Picker,
      options: [
        { label: 'AND', value: 'AND' },
        { label: 'OR', value: 'OR' },
      ],
    },
    story_types: {
      label: 'Content Warnings',
      value: [],
      type: FilterTypes.CheckboxGroup,
      options: [
        { label: 'Gore', value: '1' },
        { label: 'Sexuality violent', value: '2' },
        { label: 'Mature', value: '3' },
        { label: 'Strong language', value: '4' },
      ],
    },
  };

  async popularNovels(
    pageNo: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    if (showLatestNovels) {
      filters.sort_by.value = 'date';
    }

    const areFiltersSet =
      (filters.genres.value.included && filters.genres.value.included.length > 0) ||
      (filters.genres.value.excluded && filters.genres.value.excluded.length > 0) ||
      filters.story_types.value.length > 0 ||
      filters.story_origin.value !== 'all' ||
      filters.status_filter.value !== 'all' ||
      filters.genre_logic.value !== 'AND' ||
      filters.story_type_logic.value !== 'OR' ||
      (showLatestNovels ? false : filters.sort_by.value !== 'date');

    if (!areFiltersSet && pageNo === 1 && !showLatestNovels) {
      const result = await fetchApi(this.site, this.getRequestInit());
      const body = await result.text();
      const $ = loadCheerio(body);
      const novels: Plugin.NovelItem[] = [];
      $('div.novel-slide').each((i, el) => {
        const novelPath = $(el).find('.title-info-v1 > a').attr('href');
        if (novelPath) {
          const novelName = $(el).find('.title-info-v1 > a > h3').text().trim();
          let novelCover = $(el).find('.popular_title_image img').attr('src');
          if (novelCover && !novelCover.startsWith('http')) {
            novelCover = this.site + novelCover;
          }
          novels.push({ name: novelName, path: novelPath, cover: novelCover });
        }
      });
      return novels;
    }

    const url = new URL(this.site + '/advanced-search/');
    url.searchParams.set('page', pageNo.toString());
    url.searchParams.set('sort_by', filters.sort_by.value);
    url.searchParams.set('sort_order', filters.sort_order.value);
    url.searchParams.set('status_filter', filters.status_filter.value);
    url.searchParams.set('story_origin', filters.story_origin.value);
    url.searchParams.set('genre_logic', filters.genre_logic.value);
    url.searchParams.set('story_type_logic', filters.story_type_logic.value);

    filters.genres.value.included.forEach(val =>
      url.searchParams.append('genres', val),
    );
    filters.genres.value.excluded.forEach(val =>
      url.searchParams.append('exclude_genres', val),
    );
    filters.story_types.value.forEach(val =>
      url.searchParams.append('story_types', val),
    );

    const result = await fetchApi(url.toString(), this.getRequestInit());
    const body = await result.text();
    const $ = loadCheerio(body);
    const novels: Plugin.NovelItem[] = [];

    $('li.search-result-item').each((i, el) => {
      const novelPath = $(el).find('a.search-result-title-link').attr('href');
      if (novelPath) {
        const novelName = $(el).find('h2.search-result-title').text().trim();
        let novelCover = $(el).find('img.search-result-image').attr('src');
        if (novelCover && !novelCover.startsWith('http')) {
          novelCover = this.site + novelCover;
        }
        novels.push({ name: novelName, path: novelPath, cover: novelCover });
      }
    });

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const novelUrl = this.resolveUrl(novelPath);
    const result = await fetchApi(novelUrl, this.getRequestInit());
    const body = await result.text();
    const $ = loadCheerio(body);

    let coverUrl = $('img#novel-cover-image').attr('src');
    if (coverUrl) {
      coverUrl = this.resolveUrl(coverUrl);
    }

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: $('h1.novel-title').text().trim(),
      cover: coverUrl,
      summary: $('.summary-text').text().trim(),
      author: $('.novel-author a').text().trim(),
    };

    const genres: string[] = [];
    $('.genres-container a.genre, .tags-container a.tag').each((i, el) => {
      genres.push($(el).text().trim());
    });
    novel.genres = genres.join(', ');

    const statusText = $('.novel-status .status-indicator').text().trim();
    novel.status =
      statusText.toLowerCase() === 'ongoing'
        ? NovelStatus.Ongoing
        : statusText.toLowerCase() === 'completed'
        ? NovelStatus.Completed
        : NovelStatus.Unknown;

    const chapters: Plugin.ChapterItem[] = [];

    const parseChaptersFromPage = (ch: CheerioAPI) => {
      ch('ul.chapter-list li.chapter-item').each((i, el) => {
        const chapterLink = ch(el).find('a.chapter-link');
        const chapterPath = chapterLink.attr('href');
        if (chapterPath) {
          const chapterName = chapterLink.text().trim();
          const releaseDate = ch(el).find('span.chapter-date').text().trim();
          chapters.push({
            name: chapterName,
            path: chapterPath,
            releaseTime: releaseDate,
          });
        }
      });
    };

    parseChaptersFromPage($);

    const lastPageLink = $('.pagination a:contains("Last")').attr('href');
    let lastPage = 1;
    if (lastPageLink) {
      try {
        const urlParams = new URLSearchParams(lastPageLink.split('?')[1]);
        lastPage = Number(urlParams.get('page')) || 1;
      } catch (e) {
        const pageMatch = lastPageLink.match(/page=(\d+)/);
        if (pageMatch) {
          lastPage = Number(pageMatch[1]);
        }
      }
    } else {
      let maxPage = 1;
      $('.pagination a[href*="page="]').each((i, el) => {
        const page = Number($(el).text());
        if (!isNaN(page) && page > maxPage) {
          maxPage = page;
        }
      });
      lastPage = maxPage;
    }

    for (let i = 2; i <= lastPage; i++) {
      const pageUrl = `${novelUrl}?page=${i}`;
      const pageResult = await fetchApi(pageUrl, this.getRequestInit());
      const pageBody = await pageResult.text();
      const $$ = loadCheerio(pageBody);
      parseChaptersFromPage($$);
    }

    novel.chapters = chapters.reverse();
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const result = await fetchApi(
      this.resolveUrl(chapterPath),
      this.getRequestInit(),
    );
    const body = await result.text();
    const $ = loadCheerio(body);

    const chapterText = $('.formatted-content').html();
    return chapterText || '';
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}/search/?q=${encodeURIComponent(
      searchTerm,
    )}&page=${pageNo}`;
    const result = await fetchApi(url, this.getRequestInit());
    const body = await result.text();
    const $ = loadCheerio(body);

    const novels: Plugin.NovelItem[] = [];

    $('li.search-result-item').each((i, el) => {
      const novelPath = $(el).find('a.search-result-title-link').attr('href');
      if (novelPath) {
        const novelName = $(el).find('h2.search-result-title').text().trim();
        let novelCover = $(el).find('img.search-result-image').attr('src');
        if (novelCover && !novelCover.startsWith('http')) {
          novelCover = this.site + novelCover;
        }
        novels.push({ name: novelName, path: novelPath, cover: novelCover });
      }
    });

    return novels;
  }

  resolveUrl = (path: string) => {
    if (path.startsWith('http')) {
      return path;
    }
    return this.site + path;
  };
}

export default new MzNovelsPlugin();
