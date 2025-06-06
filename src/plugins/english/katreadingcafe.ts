import { fetchApi } from '@libs/fetch';
import { Plugin } from '@typings/plugin';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';
// import dayjs from 'dayjs'; 

class KatReadingCafePlugin implements Plugin.PluginBase {
    id = "katreadingcafe";
    name = "Kat Reading Cafe";
    icon = "src/en/katreadingcafe/icon.png";
    site = "https://katreadingcafe.com";
    version = "1.0.0";

    filters: Filters = {
        order: {
            label: "Order by",
            value: "popular",
            options: [
                { label: "Default", value: "" }, { label: "A-Z", value: "title" },
                { label: "Z-A", value: "titlereverse" }, { label: "Latest Update", value: "update" },
                { label: "Latest Added", value: "latest" }, { label: "Popular", value: "popular" },
                { label: "Rating", value: "rating" },
            ],
            type: FilterTypes.Picker,
        },
        status: {
            label: "Status",
            value: "", 
            options: [
                { label: "All", value: "" }, { label: "Ongoing", value: "ongoing" },
                { label: "Hiatus", value: "hiatus" }, { label: "Completed", value: "completed" },
            ],
            type: FilterTypes.Picker,
        },
        typeF: { 
            label: "Type",
            value: [], 
            options: [
                { label: "Fan Fiction", value: "fan-fiction" }, { label: "Web Novel", value: "web-novel" },
                { label: "WIP", value: "wip" }, 
            ],
            type: FilterTypes.CheckboxGroup,
        },
        genre: {
            label: "Genre",
            value: [], 
            options: [
                { label: "Action", value: "action" }, { label: "Adult", value: "adult" },
                { label: "Adventure", value: "adventure" }, { label: "Comedy", value: "comedy" },
                { label: "Drama", value: "drama" }, { label: "Ecchi", value: "ecchi" },
                { label: "Fantasy", value: "fantasy" }, { label: "Gender Bender", value: "gender-bender" },
                { label: "Harem", value: "harem" }, { label: "Historical", value: "historical" },
                { label: "Horror", value: "horror" }, { label: "Martial Arts", value: "martial-arts" },
                { label: "Mature", value: "mature" }, { label: "MTL", value: "mtl" },
                { label: "Mystery", value: "mystery" }, { label: "Psychological", value: "psychological" },
                { label: "Romance", value: "romance" }, { label: "School Life", value: "school-life" },
                { label: "Sci-fi", value: "sci-fi" }, { label: "Seinen", value: "seinen" },
                { label: "Shoujo", value: "shoujo" }, { label: "Shoujo Ai", value: "shoujo-ai" },
                { label: "Slice of Life", value: "slice-of-life" }, { label: "Smut", value: "smut" },
                { label: "Supernatural", value: "supernatural" }, { label: "Tragedy", value: "tragedy" },
                { label: "WIP", value: "wip" }, { label: "Xianxia", value: "xianxia" },
                { label: "Xuanhuan", value: "xuanhuan" }, { label: "Yuri", value: "yuri" },
            ],
            type: FilterTypes.CheckboxGroup,
        },
    } satisfies Filters;

    async popularNovels(
        pageNo: number,
        options: Plugin.PopularNovelsOptions<typeof this.filters>,
    ): Promise<Plugin.NovelItem[]> {
        let baseUrl = this.site + '/series/';
        let pagedUrl = baseUrl; // Renamed for clarity
        if (pageNo > 1) {
            pagedUrl = baseUrl + `page/${pageNo}/`;
        }

        const params = new URLSearchParams();
        if (options.showLatestNovels) {
            params.append('order', 'update'); 
        } else {
            if (options.filters.order.value) {
                params.append('order', options.filters.order.value);
            }
        }
        if (options.filters.status.value) {
            params.append('status', options.filters.status.value);
        }
        
        const typeFFilterValue = options.filters.typeF?.value;
        if (Array.isArray(typeFFilterValue)) {
            typeFFilterValue.forEach(type => params.append('type[]', type));
        }

        const genreFilterValue = options.filters.genre?.value;
        if (Array.isArray(genreFilterValue)) {
            genreFilterValue.forEach(genre => params.append('genre[]', genre));
        }
        
        const queryString = params.toString();
        let finalUrl = pagedUrl;
        if (queryString) {
            finalUrl += '?' + queryString;
        }

        const result = await fetchApi(finalUrl);
        const body = await result.text();
        const $ = loadCheerio(body);

        const novels: Plugin.NovelItem[] = [];
        $('div.listupd article.maindet').each((i, element) => {
            const novelUrl = $(element).find('.mdthumb a').attr('href');
            const novelName = $(element).find('.mdinfo h2 a').text().trim();
            let novelCover = $(element).find('.mdthumb a img').attr('src');

            if (novelUrl && novelName) { // Ensure novelName is also present
                 novels.push({
                    name: novelName,
                    url: novelUrl, 
                    cover: novelCover ? new URL(novelCover, this.site).href : defaultCover,
                });
            }
        });
        return novels;
    }

    async parseNovelAndChapters(novelUrl: string): Promise<Plugin.SourceNovel> {
        const result = await fetchApi(novelUrl);
        const body = await result.text();
        const $ = loadCheerio(body);
    
        const novel: Plugin.SourceNovel = {
            url: novelUrl,
            name: "Untitled",
            cover: defaultCover,
            author: "",
            artist: "",
            status: NovelStatus.Unknown,
            genres: "",
            summary: "",
            chapters: [],
        };

        const parsedName = $('h1.entry-title').text().trim();
        if (parsedName) {
            novel.name = parsedName;
        }
    
        const coverSrc = $('.sertothumb img').attr('src');
        if (coverSrc) {
            novel.cover = new URL(coverSrc, this.site).href;
        }
    
        $('.sertoinfo .sertoauth .serl').each(function () {
            const label = $(this).find('.sername').text().trim();
            const valueElem = $(this).find('.serval');
            const value = valueElem.text().trim();

            if (label === 'Author') {
                novel.author = value || ""; 
            }
        });
        
        const statusText = $('.sertostat span').text().trim().toLowerCase();
        switch (statusText) {
            case 'ongoing':
                novel.status = NovelStatus.Ongoing;
                break;
            case 'completed':
                novel.status = NovelStatus.Completed;
                break;
            case 'hiatus':
                novel.status = NovelStatus.Hiatus; // Changed to OnHiatus for consistency with NovelStatus enum
                break;
        }
    
        const parsedGenres = $('.sertogenre a').map((i, el) => $(el).text().trim()).get().join(', ');
        if (parsedGenres) {
             novel.genres = parsedGenres;
        }

        const parsedSummary = $('.sersys.entry-content').text().trim();
        if (parsedSummary) {
            novel.summary = parsedSummary;
        }
    
        const chapters: Plugin.ChapterItem[] = [];
        $('.eplister ul li').each((i, element) => {
            const chapterA = $(element).find('a');
            const chapterUrl = chapterA.attr('href');
            if (!chapterUrl) return;

            const numText = chapterA.find('.epl-num').text().trim(); 
            const titleText = chapterA.find('.epl-title').text().trim();
            const releaseTime = chapterA.find('.epl-date').text().trim();

            let chapterName = numText;
            if (titleText) {
                chapterName = `${numText} - ${titleText}`;
            }
            
            let parsedChapterNumber: number | undefined = undefined;
            const chNumMatchSimple = numText.match(/Ch\.?\s*(\d+(\.\d+)?)/i);
            const chNumMatchVolume = numText.match(/Vol\.?\s*\d+\s*Ch\.?\s*(\d+(\.\d+)?)/i);

            let tempNumStr: string | undefined;
            if (chNumMatchVolume && chNumMatchVolume[1]) {
                tempNumStr = chNumMatchVolume[1];
            } else if (chNumMatchSimple && chNumMatchSimple[1]) {
                tempNumStr = chNumMatchSimple[1];
            }

            if (tempNumStr) {
                const num = parseFloat(tempNumStr);
                if (!isNaN(num)) {
                    parsedChapterNumber = num;
                }
            }

            chapters.push({
                name: chapterName,
                url: chapterUrl,
                releaseTime: releaseTime, // Consider parsing with dayjs: dayjs(releaseTime, "MMMM D, YYYY").toISOString()
                chapterNumber: parsedChapterNumber,
            });
        });
    
        novel.chapters = chapters.reverse(); 
    
        return novel;
    }
    
    async parseChapter(chapterUrl: string): Promise<string> {
        const result = await fetchApi(chapterUrl); 
        const body = await result.text();
        const $ = loadCheerio(body);
    
        const chapterHtml = $('.epcontent.entry-content');
        
        chapterHtml.find('h1.entry-title').remove();
        chapterHtml.find('.kofi-button-container').remove(); 
        chapterHtml.find('div[class*="kofi-"]').remove();
        chapterHtml.find('center').filter((i, el) => $(el).find('a[href*="ko-fi.com"]').length > 0).remove();
        chapterHtml.find('span[style*="position: absolute"]').remove();
        chapterHtml.find('comment()').remove();

        chapterHtml.find('p').each((i, el) => {
            if ($(el).text().trim() === '' && $(el).children().length === 0) {
                $(el).remove();
            }
        });
        
        return chapterHtml.html() || "";
    }

    async searchNovels(
        searchTerm: string, 
        pageNo: number
    ): Promise<Plugin.NovelItem[]> {
        let url = `${this.site}/?s=${encodeURIComponent(searchTerm)}`;
        if (pageNo > 1) {
            url = `${this.site}/page/${pageNo}/?s=${encodeURIComponent(searchTerm)}`;
        }
    
        const result = await fetchApi(url);
        const body = await result.text();
        const $ = loadCheerio(body);
    
        const novels: Plugin.NovelItem[] = [];
        $('div.listupd article.maindet').each((i, element) => {
            const novelUrl = $(element).find('.mdthumb a').attr('href');
            const novelName = $(element).find('.mdinfo h2 a').text().trim();
            let novelCover = $(element).find('.mdthumb a img').attr('src');

            if (novelUrl && novelName) { // Ensure novelName is also present
                 novels.push({
                    name: novelName,
                    url: novelUrl,
                    cover: novelCover ? new URL(novelCover, this.site).href : defaultCover,
                });
            }
        });
        return novels;
    }
}
export default new KatReadingCafePlugin();