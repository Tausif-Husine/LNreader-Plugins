import { load as parseHTML } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@typings/plugin';
import { defaultCover } from '@libs/defaultCover';
import dayjs from 'dayjs';
import { storage } from '@libs/storage';
import { NovelStatus } from '@libs/novelStatus';

class MyNovels implements Plugin.PagePlugin {
  id = 'mynovels';
  name = 'MyNovels';
  icon = 'src/en/mynovels/icon.png';
  site = 'https://mynovels.net/';
  version = '1.0.0';

  webStorageUtilized = true;

  pluginSettings = {
    hideLocked: {
      value: storage.get('hideLocked') || false,
      label: 'Hide locked chapters',
      type: 'Switch',
      description: 'Hides chapters that require payment to read. Requires a refresh.',
    },
  };

  private getHideLockedValue(): boolean {
    const setting = this.pluginSettings?.hideLocked.value;
    return typeof setting === 'boolean' ? setting : false;
  }

  async popularNovels(page: number): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}catalog/?ordering=popularity&page=${page}`;
    const body = await fetchApi(url).then(r => r.text());
    const loadedCheerio = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];
    loadedCheerio('a.item').each((idx, ele) => {
      const novelPath = loadedCheerio(ele).attr('href');
      if (!novelPath) return;

      novels.push({
        name: loadedCheerio(ele).find('div.title').text().trim(),
        path: novelPath.replace(/^\//, ''),
        cover: loadedCheerio(ele).find('img').attr('src')
          ? this.site + loadedCheerio(ele).find('img').attr('src')
          : defaultCover,
      });
    });

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel & { totalPages: number }> {
    const novelUrl = this.site + novelPath;
    const body = await fetchApi(novelUrl).then(r => r.text());
    const loadedCheerio = parseHTML(body);

    const novel: Plugin.SourceNovel & { totalPages: number } = {
      path: novelPath,
      name: loadedCheerio('h1').text() || 'Untitled',
      cover: this.site + loadedCheerio('.poster > img').attr('src'),
      summary: loadedCheerio('section.text-info.section > p').text(),
      totalPages: loadedCheerio('#select-pagination-chapter > option').length,
      chapters: [], // Chapters will be loaded by parsePage
    };
    
    // Parse novel metadata
    const info = loadedCheerio('div.mini-info > .item').toArray();
    let status = '', translation = '';
    for (const child of info) {
        const type = loadedCheerio(child).find('.sub-header').text().trim();
        switch (type) {
            case 'Status': status = loadedCheerio(child).find('div.info').text().trim(); break;
            case 'Translation': translation = loadedCheerio(child).find('div.info').text().trim(); break;
            case 'Author': novel.author = loadedCheerio(child).find('div.info').text().trim(); break;
            case 'Genres':
                novel.genres = loadedCheerio(child).find('div.info > a').map((i, el) => loadedCheerio(el).text()).toArray().join(', ');
                break;
        }
    }

    if (status === 'cancelled') novel.status = NovelStatus.Cancelled;
    else if (status === 'releasing' || translation === 'ongoing') novel.status = NovelStatus.Ongoing;
    else if (status === 'completed' && translation === 'completed') novel.status = NovelStatus.Completed;

    return novel;
  }

  async parsePage(novelPath: string, page: string): Promise<Plugin.SourcePage> {
    const novelUrl = this.site + novelPath;
    const rawBody = await fetchApi(novelUrl).then(r => r.text());
    
    const csrftoken = rawBody.match(/window\.CSRF_TOKEN = "([^"]+)"/)?.[1];
    const bookId = rawBody.match(/const OBJECT_BY_COMMENT = ([0-9]+)/)?.[1];
    const totalPages = parseHTML(rawBody)('#select-pagination-chapter > option').length;
    
    if (!csrftoken || !bookId) {
        throw new Error("Could not fetch chapters. The site's structure might have changed.");
    }
    
    const pageToFetch = totalPages - parseInt(page) + 1;

    const chaptersRaw = await fetchApi(
      `${this.site}/book/ajax/chapter-pagination?csrfmiddlewaretoken=${csrftoken}&book_id=${bookId}&page=${pageToFetch}`,
      { headers: { 'Referer': novelUrl, 'X-Requested-With': 'XMLHttpRequest' } },
    ).then(r => r.json()).then(r => r.html);

    const chapters: Plugin.ChapterItem[] = [];
    const hideLocked = this.getHideLockedValue();

    parseHTML('<html>' + chaptersRaw + '</html>')('a').each((idx, ele) => {
      const isLocked = !!parseHTML(ele)('.cost').text().trim();
      if (hideLocked && isLocked) return;

      const chapterPath = parseHTML(ele).attr('href');
      if (!chapterPath) return;

      let releaseTime;
      try {
        releaseTime = dayjs(parseHTML(ele)('.date').text().trim(), 'DD.MM.YYYY').toISOString();
      } catch (error) { /* ignore */ }

      chapters.push({
        name: isLocked ? '🔒 ' + parseHTML(ele)('.title').text().trim() : parseHTML(ele)('.title').text().trim(),
        path: chapterPath.replace(/^\//, ''),
        releaseTime: releaseTime,
        page: page, // Set the page number for the app
      });
    });

    return { chapters: chapters.reverse() };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const chapterUrl = this.site + chapterPath;
    const rawBody = await fetchApi(chapterUrl).then(r => r.text());

    const chapterId = rawBody.match(/const CHAPTER_ID = "([0-9]+)/)?.[1];

    if (!chapterId) {
        if (rawBody.includes("chapter is locked")) {
            throw new Error('Chapter is locked. You may need to log in via WebView and purchase it.');
        }
        throw new Error('Could not find chapter content.');
    }

    let className;
    const body = await fetchApi(
      `${this.site}book/ajax/read-chapter/${chapterId}`,
      { headers: { 'Referer': chapterUrl, 'X-Requested-With': 'XMLHttpRequest' } },
    ).then(async r => {
      const res = await r.json();
      if(res.error) throw new Error(res.error);
      className = res.class;
      return res.content;
    });

    const loadedCheerio = parseHTML(body);
    const chapterText = loadedCheerio('.' + className).html() || '';
    return chapterText.replace(/class="advertisment"/g, 'style="display:none;"');
  }

  async searchNovels(searchTerm: string): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}catalog/?search=${encodeURIComponent(searchTerm)}`;
    const body = await fetchApi(url).then(r => r.text());
    const loadedCheerio = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];
    loadedCheerio('a.item').each((idx, ele) => {
      const novelPath = loadedCheerio(ele).attr('href');
      if (!novelPath) return;

      novels.push({
        name: loadedCheerio(ele).find('div.title').text().trim(),
        path: novelPath.replace(/^\//, ''),
        cover: loadedCheerio(ele).find('img').attr('src')
            ? this.site + loadedCheerio(ele).find('img').attr('src')
            : defaultCover,
      });
    });

    return novels;
  }
}

export default new MyNovels();
