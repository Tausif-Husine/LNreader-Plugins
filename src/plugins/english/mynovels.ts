import { load as parseHTML } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@typings/plugin';
import { defaultCover } from '@libs/defaultCover';
import dayjs from 'dayjs';
import { storage } from '@libs/storage';
import { NovelStatus } from '@libs/novelStatus';

class MyNovels implements Plugin.PluginBase {
  id = 'mynovels';
  name = 'MyNovels';
  icon = 'src/en/mynovels/icon.png';
  site = 'https://mynovels.net/';
  version = '1.0.0';

  webStorageUtilized = true;
  
  // Settings are preserved
  pluginSettings = {
    hideLocked: {
      value: storage.get('hideLocked') || false,
      label: 'Hide locked chapters',
      type: 'Switch',
      description: 'Hides chapters that require payment to read. Requires a refresh.'
    },
  };

  private getHideLockedValue(): boolean {
    // Access the setting value through the plugin instance
    const setting = this.pluginSettings?.hideLocked.value;
    if (typeof setting === 'boolean') {
      return setting;
    }
    // Fallback if the setting isn't a boolean for some reason
    return false;
  }

  async popularNovels(page: number): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}catalog/?ordering=popularity&page=${page}`;
    const body = await fetchApi(url).then(r => r.text());
    const loadedCheerio = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];
    loadedCheerio('a.item').each((idx, ele) => {
      const novelUrl = loadedCheerio(ele).attr('href');
      if (!novelUrl) return;

      novels.push({
        name: loadedCheerio(ele).find('div.title').text().trim(),
        url: this.site + novelUrl.replace(/^\//, ''), // Ensure absolute URL
        cover: loadedCheerio(ele).find('img').attr('src')
            ? this.site + loadedCheerio(ele).find('img').attr('src')
            : defaultCover,
      });
    });

    return novels;
  }

  async parseNovelAndChapters(novelUrl: string): Promise<Plugin.SourceNovel> {
    const body = await fetchApi(novelUrl).then(r => r.text());
    const loadedCheerio = parseHTML(body);

    const novel: Plugin.SourceNovel = {
      url: novelUrl,
      name: loadedCheerio('h1').text() || 'Untitled',
      cover: this.site + loadedCheerio('.poster > img').attr('src'),
      summary: loadedCheerio('section.text-info.section > p').text(),
      chapters: [],
    };

    const info = loadedCheerio('div.mini-info > .item').toArray();
    let status = '', translation = '';
    for (const child of info) {
      const type = loadedCheerio(child).find('.sub-header').text().trim();
      switch (type) {
        case 'Status':
          status = loadedCheerio(child).find('div.info').text().trim();
          break;
        case 'Translation':
          translation = loadedCheerio(child).find('div.info').text().trim();
          break;
        case 'Author':
          novel.author = loadedCheerio(child).find('div.info').text().trim();
          break;
        case 'Genres':
          novel.genres = loadedCheerio(child)
            .find('div.info > a')
            .map((i, el) => loadedCheerio(el).text())
            .toArray()
            .join(', ');
          break;
      }
    }

    if (status === 'cancelled') novel.status = NovelStatus.Cancelled;
    else if (status === 'releasing' || translation === 'ongoing') novel.status = NovelStatus.Ongoing;
    else if (status === 'completed' && translation === 'completed') novel.status = NovelStatus.Completed;

    // Logic to fetch all chapters from all pages
    const hideLocked = this.getHideLockedValue();
    const csrftoken = body.match(/window\.CSRF_TOKEN = "([^"]+)"/)?.[1];
    const bookId = body.match(/const OBJECT_BY_COMMENT = ([0-9]+)/)?.[1];
    const totalPages = loadedCheerio('#select-pagination-chapter > option').length;

    if (!csrftoken || !bookId || totalPages === 0) {
      // If any of these are missing, we can't fetch chapters.
      // Return the novel info without chapters.
      return novel;
    }
    
    // Create an array of promises to fetch all chapter pages concurrently
    const chapterPagePromises: Promise<string>[] = [];
    for (let i = 1; i <= totalPages; i++) {
        const pageNum = totalPages - i + 1; // Site's pagination is in reverse
        const chaptersUrl = `${this.site}/book/ajax/chapter-pagination?csrfmiddlewaretoken=${csrftoken}&book_id=${bookId}&page=${pageNum}`;
        chapterPagePromises.push(
            fetchApi(chaptersUrl, {
                headers: {
                    'Host': this.site.replace('https://', '').replace('/', ''),
                    'Referer': novelUrl,
                    'X-Requested-With': 'XMLHttpRequest',
                },
            }).then(r => r.json()).then(json => json.html)
        );
    }

    // Wait for all pages to be fetched
    const chapterPagesHtml = await Promise.all(chapterPagePromises);
    const allChapters: Plugin.ChapterItem[] = [];

    // Process each page's HTML to extract chapters
    for (const chaptersRaw of chapterPagesHtml) {
        const $chapters = parseHTML('<html>' + chaptersRaw + '</html>');
        $chapters('a').each((idx, ele) => {
            const title = $chapters(ele)('.title').text().trim();
            const isLocked = !!$chapters(ele)('.cost').text().trim();

            if (hideLocked && isLocked) return;

            const chapterUrl = $chapters(ele).attr('href');
            if (!chapterUrl) return;

            let releaseTime;
            try {
                releaseTime = dayjs($chapters(ele)('.date').text().trim(), 'DD.MM.YYYY').toISOString();
            } catch (error) {
                // Ignore if date parsing fails
            }

            allChapters.push({
                name: isLocked ? '🔒 ' + title : title,
                url: this.site + chapterUrl.replace(/^\//, ''),
                releaseTime: releaseTime,
            });
        });
    }

    // Reverse the final list because we fetched from last page to first
    novel.chapters = allChapters.reverse();

    return novel;
  }

  async parseChapter(chapterUrl: string): Promise<string> {
    const rawBody = await fetchApi(chapterUrl).then(r => r.text());

    // These values are required for the API call to get chapter content
    const csrftoken = rawBody.match(/window\.CSRF_TOKEN = "([^"]+)"/)?.[1];
    const chapterId = rawBody.match(/const CHAPTER_ID = "([0-9]+)/)?.[1];

    if (!csrftoken || !chapterId) {
        throw new Error('Chapter is locked or requires a login.');
    }

    let className: string;
    const body = await fetchApi(
      `${this.site}book/ajax/read-chapter/${chapterId}`,
      {
        method: 'GET',
        headers: {
          // The WebView will automatically provide the correct cookies
          'Referer': chapterUrl,
          'X-Requested-With': 'XMLHttpRequest',
        },
      },
    ).then(async r => {
      const res = await r.json();
      if(res.error) throw new Error(res.error);
      className = res.class;
      return res.content;
    });

    const loadedCheerio = parseHTML(body);
    const chapterText = loadedCheerio('.' + className).html() || '';

    // Clean up ads
    return chapterText.replace(/class="advertisment"/g, 'style="display:none;"');
  }

  async searchNovels(searchTerm: string): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}catalog/?search=${encodeURIComponent(searchTerm)}`;
    const body = await fetchApi(url).then(r => r.text());
    const loadedCheerio = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];
    loadedCheerio('a.item').each((idx, ele) => {
      const novelUrl = loadedCheerio(ele).attr('href');
      if (!novelUrl) return;

      novels.push({
        name: loadedCheerio(ele).find('div.title').text().trim(),
        url: this.site + novelUrl.replace(/^\//, ''),
        cover: loadedCheerio(ele).find('img').attr('src')
            ? this.site + loadedCheerio(ele).find('img').attr('src')
            : defaultCover,
      });
    });

    return novels;
  }
}

export default new MyNovels();
