import { fetchApi, fetchText } from "@libs/fetch";
import { Plugin } from "@typings/plugin";
import { FilterTypes, Filters } from "@libs/filterInputs";
import { load as loadCheerio } from "cheerio";
import { NovelStatus } from "@libs/novelStatus";

class NightStudio implements Plugin.PluginBase {
  id = "nightstudio";
  name = "Night Studio";
  icon = "src/en/nightstudio/icon.png";
  site = "https://nightstudio.site";
  version = "1.0.1";

  filters: Filters = {
    order: {
      label: "Sort by",
      value: "",
      options: [
        { label: "Default", value: "" },
        { label: "Popularity", value: "popularity" },
        { label: "Newest", value: "date_desc" },
        { label: "Oldest", value: "date_asc" },
        { label: "Title A-Z", value: "title_asc" },
        { label: "Title Z-A", value: "title_desc" },
        { label: "Ranking - Best", value: "ranking-best" },
        { label: "Ranking - Popularity", value: "ranking-popularity" },
        { label: "Ranking - Monthly", value: "ranking-monthly" },
        { label: "Ranking - Rising", value: "ranking-new" },
        { label: "Ranking - Completed", value: "ranking-completed" },
      ],
      type: FilterTypes.Picker,
    },
    status: {
      label: "Status",
      value: "",
      options: [
        { label: "All", value: "" },
        { label: "Active", value: "Active" },
        { label: "Completed", value: "Completed" },
        { label: "On Hold", value: "On Hold" },
        { label: "Dropped", value: "Dropped" },
      ],
      type: FilterTypes.Picker,
    },
    tag: {
      label: "Theme",
      value: "",
      options: [
        { label: "All", value: "" },
        { label: "Animal", value: "animal" },
        { label: "Comedy", value: "comedy" },
        { label: "Cooking", value: "cooking" },
        { label: "Court Drama", value: "court-drama" },
        { label: "Engagement/Marriage", value: "forced-marriage" },
        { label: "Farming", value: "farming" },
        { label: "Romance", value: "romance" },
        { label: "Sci-fi", value: "sci-fi" },
        { label: "Slice of Life", value: "slice-of-life" },
        { label: "Supernatural", value: "supernatural" },
        { label: "System", value: "system" },
        { label: "Villainess", value: "villainess" },
        { label: "Wealthy CEO", value: "wealthy-ceo" },
      ],
      type: FilterTypes.Picker,
    },
  } satisfies Filters;
  
  async popularNovels(
    pageNo: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>
  ): Promise<Plugin.NovelItem[]> {
    if (showLatestNovels) {
      if (pageNo > 1) return []; // Latest updates are only on the first page
      const body = await fetchText(this.site);
      const $ = loadCheerio(body);

      const novels: Plugin.NovelItem[] = [];
      $(".latest_chapter_release").each((i, el) => {
        const novelA = $(el).find(".latest_release_novel_title a");
        const novelUrl = novelA.attr("href");
        if (!novelUrl) return;

        const novelPath = new URL(novelUrl).pathname;
        if (novels.some((n) => n.path === novelPath)) {
          return;
        }

        const novelName = novelA.text().trim();
        const novelCover = $(el).find(".latest_chapter_cover").attr("src");

        novels.push({
          name: novelName,
          path: novelPath,
          cover: novelCover,
        });
      });
      return novels;
    }

    const order = filters.order.value;

    if (order.startsWith("ranking-")) {
      if (pageNo > 1) return []; // Ranking page has no pagination
      const rankingSort = order.replace("ranking-", "");
      const url = `${this.site}/ranking?sort=${rankingSort}`;
      const body = await fetchText(url);
      const $ = loadCheerio(body);

      const novels: Plugin.NovelItem[] = [];
      $(".ranking-novel-item").each((i, el) => {
        const novelUrl = $(el).find("a").attr("href");
        if (!novelUrl) return;

        const novelName = $(el).find(".ranking-novel-item-title").text().trim();
        const novelCover = $(el).find(".ranking-novel-item-cover").attr("src");

        novels.push({
          name: novelName,
          path: new URL(novelUrl).pathname,
          cover: novelCover,
        });
      });
      return novels;
    }

    let url = `${this.site}/novels/`;
    if (pageNo > 1) {
      url += `page/${pageNo}/`;
    }

    const params = new URLSearchParams();
    if (filters.order.value) params.append("sort", filters.order.value);
    if (filters.status.value) params.append("status", filters.status.value);
    if (filters.tag.value) params.append("tag", filters.tag.value);

    url += "?" + params.toString();

    const body = await fetchText(url);
    const $ = loadCheerio(body);

    const novels: Plugin.NovelItem[] = [];
    $(".novel-item").each((i, el) => {
      const novelUrl = $(el).attr("href");
      if (!novelUrl) return;

      const novelName = $(el).find(".novel-item-title").text().trim();
      const novelCover = $(el).find(".novel-item-Cover").attr("src");

      novels.push({
        name: novelName,
        path: new URL(novelUrl).pathname,
        cover: novelCover,
      });
    });

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const url = this.site + novelPath;
    const body = await fetchText(url);
    const $ = loadCheerio(body);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: $('h1.entry-title, h1.title, #index_heading').first().text().trim(),
    };

    novel.cover = $("#novel_cover").attr("src");
    novel.summary = $(".desc_div p")
      .map((i, el) => $(el).text())
      .get()
      .join("\n");

    novel.author = $("#novel_author-button")?.text()?.trim();
      
    novel.genres = $("#tags_div a.novel_genre")
      .map((i, el) => $(el).text().trim())
      .get()
      .join(", ");

    const status = $("#novel_status").text().trim();
    switch (status) {
      case "Active":
        novel.status = NovelStatus.Ongoing;
        break;
      case "Completed":
        novel.status = NovelStatus.Completed;
        break;
      case "On Hold":
        novel.status = NovelStatus.OnHiatus;
        break;
      case "Dropped":
        novel.status = NovelStatus.Cancelled;
        break;
    }

    const chapters: Plugin.ChapterItem[] = [];
    $(".novel_index a.chap").each((i, el) => {
      const chapterUrl = $(el).attr("href");
      if (!chapterUrl) return;

      chapters.push({
        name: $(el).text().trim(),
        path: new URL(chapterUrl).pathname,
        releaseTime: null,
      });
    });

    novel.chapters = chapters.reverse();
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = this.site + chapterPath;
    const body = await fetchText(url);
    const $ = loadCheerio(body);

    const content = $('.bs-blog-post');
    content.find(".mycred-sell-this-wrapper, .myCRED-buy-form, .mycred-sell-this-history").remove();

    const chapterText = content.find("p.chapter_content")
      .map((i, el) => `<p>${$(el).html()}</p>`)
      .get()
      .join("");

    return chapterText;
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number
  ): Promise<Plugin.NovelItem[]> {
    let url = `${this.site}/novels/`;
    if (pageNo > 1) {
      url += `page/${pageNo}/`;
    }
    url += `?search=${searchTerm}`;

    const body = await fetchText(url);
    const $ = loadCheerio(body);

    const novels: Plugin.NovelItem[] = [];
    $(".novel-item").each((i, el) => {
      const novelUrl = $(el).attr("href");
      if (!novelUrl) return;

      const novelName = $(el).find(".novel-item-title").text().trim();
      const novelCover = $(el).find(".novel-item-Cover").attr("src");

      novels.push({
        name: novelName,
        path: new URL(novelUrl).pathname,
        cover: novelCover,
      });
    });

    return novels;
  }
}

export default new NightStudio();