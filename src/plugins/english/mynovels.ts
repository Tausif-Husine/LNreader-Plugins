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
        path: novelPath.replace(/^\//, ''), // Use relative path
        cover: loadedCheerio(ele).find('img').attr('src')
          ? this.site + loadedCheerio(ele).find('img').attr('src')
          : defaultCover,
      });
    });

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const novelUrl = this.site + novelPath;
    const body = await fetchApi(novelUrl).then(r => r.text());
    const loadedCheerio = parseHTML(body);

    const novel: Plugin.SourceNovel = {
      path: novelPath, // Use relative path
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

    const hideLocked = this.getHideLockedValue();
    const csrftoken = body.match(/window\.CSRF_TOKEN = "([^"]+)"/)?.[1];
    const bookId = body.match(/const OBJECT_BY_COMMENT = ([0-9]+)/)?.[1];
    const totalPages = loadedCheerio('#select-pagination-chapter > option').length;

    if (!csrftoken || !bookId || totalPages === 0) {
      return novel;
    }
    
    const chapterPagePromises: Promise<string>[] = [];
    for (let i = 1; i <= totalPages; i++) {
        const pageNum = totalPages - i + 1;
        const chaptersUrl = `${this.site}/book/ajax/chapter-pagination?csrfmiddlewaretoken=${csrftoken}&book_id=${bookId}&page=${pageNum}`;
        chapterPagePromises.push(
            fetchApi(chaptersUrl, {
                headers: { 'Referer': novelUrl, 'X-Requested-With': 'XMLHttpRequest' },
            }).then(r => r.json()).then(json => json.html)
        );
    }

    const chapterPagesHtml = await Promise.all(chapterPagePromises);
    const allChapters: Plugin.ChapterItem[] = [];

    for (const chaptersRaw of chapterPagesHtml) {
        const $chapters = parseHTML('<html>' + chaptersRaw + '</html>');
        $chapters('a').each((idx, ele) => {
            const isLocked = !!$chapters(ele)('.cost').text().trim();
            if (hideLocked && isLocked) return;

            const chapterPath = $chapters(ele).attr('href');
            if (!chapterPath) return;
            
            let releaseTime;
            try {
                releaseTime = dayjs($chapters(ele)('.date').text().trim(), 'DD.MM.YYYY').toISOString();
            } catch (e) { /* ignore */ }

            allChapters.push({
                name: isLocked ? '🔒 ' + $chapters(ele)('.title').text().trim() : $chapters(ele)('.title').text().trim(),
                path: chapterPath.replace(/^\//, ''), // Use relative path
                releaseTime: releaseTime,
            });
        });
    }

    novel.chapters = allChapters.reverse();
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const chapterUrl = this.site + chapterPath;
    const rawBody = await fetchApi(chapterUrl).then(r => r.text());

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
        headers: { 'Referer': chapterUrl, 'X-Requested-With': 'XMLHttpRequest' },
      },
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
        path: novelPath.replace(/^\//, ''), // Use relative path
        cover: loadedCheerio(ele).find('img').attr('src')
            ? this.site + loadedCheerio(ele).find('img').attr('src')
            : defaultCover,
      });
    });

    return novels;
  }
}

export default new MyNovels();
