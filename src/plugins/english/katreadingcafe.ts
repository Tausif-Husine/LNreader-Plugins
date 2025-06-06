import { fetchApi } from '@libs/fetch';
import { Plugin } from '@typings/plugin';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

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
                { label: "Default", value: "" },
                { label: "A-Z", value: "title" },
                { label: "Z-A", value: "titlereverse" },
                { label: "Latest Update", value: "update" },
                { label: "Latest Added", value: "latest" },
                { label: "Popular", value: "popular" },
                { label: "Rating", value: "rating" },
            ],
            type: FilterTypes.Picker,
        },
        status: {
            label: "Status",
            value: "", // Default to All
            options: [
                { label: "All", value: "" },
                { label: "Ongoing", value: "ongoing" },
                { label: "Hiatus", value: "hiatus" },
                { label: "Completed", value: "completed" },
            ],
            type: FilterTypes.Picker,
        },
        typeF: { 
            label: "Type",
            value: [], // Default to empty (All)
            options: [
                { label: "Fan Fiction", value: "fan-fiction" },
                { label: "Web Novel", value: "web-novel" },
                { label: "WIP", value: "wip" }, 
            ],
            type: FilterTypes.CheckboxGroup,
        },
        genre: {
            label: "Genre",
            value: [], // Default to empty (All)
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
        let PagedUrl = baseUrl;
        if (pageNo > 1) {
            PagedUrl = baseUrl + `page/${pageNo}/`;
        }

        const params = new URLSearchParams();
        if (options.showLatestNovels) {
            params.append('order', 'update'); // Or 'latest' if preferred for "Latest" button
        } else {
            if (options.filters.order.value) {
                params.append('order', options.filters.order.value);
            }
        }
        if (options.filters.status.value) {
            params.append('status', options.filters.status.value);
        }
        
        // Access filter values using the keys defined in this.filters
        const typeFFilterValue = options.filters.typeF?.value;
        if (Array.isArray(typeFFilterValue)) {
            typeFFilterValue.forEach(type => params.append('type[]', type));
        }

        const genreFilterValue = options.filters.genre?.value;
        if (Array.isArray(genreFilterValue)) {
            genreFilterValue.forEach(genre => params.append('genre[]', genre));
        }
        
        const queryString = params.toString();
        let finalUrl = PagedUrl;
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

            if (novelUrl) {
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
            name: $('h1.entry-title').text().trim() || "Untitled",
        };
    
        const coverSrc = $('.sertothumb img').attr('src');
        novel.cover = coverSrc ? new URL(coverSrc, this.site).href : defaultCover;
    
        $('.sertoinfo .sertoauth .serl').each(function () {
            const label = $(this).find('.sername').text().trim();
            const value = $(this).find('.serval').text().trim();
            const valueLink = $(this).find('.serval a').text().trim();

            if (label === 'Author') {
                novel.author = valueLink || value;
            }
            // Artist field can be added if relevant
            // if (label === 'Artist') {
            //    novel.artist = valueLink || value;
            // }
        });
        
        const statusText = $('.sertostat span').text().trim();
        switch (statusText.toLowerCase()) {
            case 'ongoing':
                novel.status = NovelStatus.Ongoing;
                break;
            case 'completed':
                novel.status = NovelStatus.Completed;
                break;
            case 'hiatus':
                novel.status = NovelStatus.Hiatus;
                break;
            default:
                novel.status = NovelStatus.Unknown;
        }
    
        novel.genres = $('.sertogenre a').map((i, el) => $(el).text().trim()).get().join(', ');
        novel.summary = $('.sersys.entry-content').text().trim(); // Using .text() to get clean summary
    
        const chapters: Plugin.ChapterItem[] = [];
        $('.eplister ul li').each((i, element) => {
            const chapterA = $(element).find('a');
            const chapterUrl = chapterA.attr('href');
            if (!chapterUrl) return;

            const numText = chapterA.find('.epl-num').text().trim(); 
            const titleText = chapterA.find('.epl-title').text().trim();
            const releaseTime = chapterA.find('.epl-date').text().trim(); // Example: "June 3, 2025"

            let chapterName = numText;
            if (titleText) {
                chapterName += " - " + titleText;
            }
            
            let chapterNumber = 0; // Default if parsing fails
            const chNumMatchSimple = numText.match(/Ch\.?\s*(\d+(\.\d+)?)/i);
            const chNumMatchVolume = numText.match(/Vol\.?\s*\d+\s*Ch\.?\s*(\d+(\.\d+)?)/i);

            if (chNumMatchVolume && chNumMatchVolume[1]) {
                chapterNumber = parseFloat(chNumMatchVolume[1]);
            } else if (chNumMatchSimple && chNumMatchSimple[1]) {
                chapterNumber = parseFloat(chNumMatchSimple[1]);
            }

            chapters.push({
                name: chapterName,
                url: chapterUrl,
                releaseTime: releaseTime, // Can be parsed with dayjs if needed: dayjs(releaseTime, "MMMM D, YYYY").toISOString()
                chapterNumber: chapterNumber 
            });
        });
    
        novel.chapters = chapters.reverse(); // Site lists newest first, so reverse for oldest first
    
        return novel;
    }
    
    async parseChapter(chapterUrl: string): Promise<string> {
        const result = await fetchApi(chapterUrl); 
        const body = await result.text();
        const $ = loadCheerio(body);
    
        const chapterHtml = $('.epcontent.entry-content');
        
        // Remove elements that are not part of the chapter content
        chapterHtml.find('h1:first-child').remove(); 
        chapterHtml.find('.kofi-button-container').remove(); 
        chapterHtml.find('span[style*="position: absolute"]').remove(); // Remove obfuscation spans
        // Remove any other known ad, navigation, or social sharing blocks if they appear within .epcontent
        
        return chapterHtml.html() || "";
    }

    async searchNovels(
        searchTerm: string, 
        pageNo: number
    ): Promise<Plugin.NovelItem[]> {
        let url = `${this.site}/?s=${encodeURIComponent(searchTerm)}`;
        if (pageNo > 1) {
            // The search URL structure for pagination seems to be /page/X/?s=search
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

            if (novelUrl) {
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
