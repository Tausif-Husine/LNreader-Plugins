import { fetchApi } from '@libs/fetch';
import { Plugin } from '@typings/plugin';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { load as loadCheerio, CheerioAPI } from 'cheerio';
import { NovelStatus } from '@libs/novelStatus';

class MzNovelsPlugin implements Plugin.PluginBase {
  id = 'mznovels';
  name = 'MzNovels';
  icon = 'src/en/mznovels/icon.png';
  site = 'https://mznovels.com';
  version = '1.0.0';

  customUserAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  private getRequestInit(): RequestInit {
    return {
      headers: {
        'User-Agent': this.customUserAgent,
      },
    };
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
    tag_logic: {
      label: 'Tag Logic (for included)',
      value: 'AND',
      type: FilterTypes.Picker,
      options: [
        { label: 'AND', value: 'AND' },
        { label: 'OR', value: 'OR' },
      ],
    },
    tags: {
      label: 'Tags',
      value: { included: [], excluded: [] },
      type: FilterTypes.ExcludableCheckboxGroup,
      options: [
        { label: 'Abandoned at Birth', value: '1' },
        { label: 'Accidental Pregnancy', value: '2' },
        { label: 'Adopted Sibling Love', value: '3' },
        { label: 'Age Gap Romance', value: '4' },
        { label: 'Alchemy Master', value: '5' },
        { label: 'Ancient Artifact', value: '6' },
        { label: 'Ancient China', value: '7' },
        { label: 'Ancient Curse', value: '8' },
        { label: 'Ancient Magician', value: '9' },
        { label: 'Amnesia', value: '10' },
        { label: 'Angst', value: '11' },
        { label: 'Apprentice’s Journey', value: '12' },
        { label: 'Arranged Marriage', value: '13' },
        { label: 'Awkward Love Confessions', value: '14' },
        { label: 'Awakening Powers', value: '15' },
        { label: 'Bad Boy with a Heart of Gold', value: '16' },
        { label: 'Beast Tamer', value: '17' },
        { label: 'Beta Male Lead', value: '18' },
        { label: 'Betrayal by Loved Ones', value: '19' },
        { label: 'Betrayed Best Friend', value: '20' },
        { label: 'Bittersweet Romance', value: '21' },
        { label: 'Black-Bellied Protagonist', value: '22' },
        { label: 'Blood Cultivator', value: '23' },
        { label: 'Bloodline Power', value: '24' },
        { label: 'Body Swap', value: '25' },
        { label: 'Broken Engagement', value: '26' },
        { label: 'Childhood Friends', value: '27' },
        { label: 'Childhood Vows', value: '28' },
        { label: 'Clones and Duplicates', value: '29' },
        { label: 'Cold Beauty', value: '30' },
        { label: 'Cold CEO Male Lead', value: '31' },
        { label: 'Contract Marriage', value: '32' },
        { label: 'Crossdressing Protagonist', value: '33' },
        { label: 'Cultivation Furnace', value: '34' },
        { label: 'Cultivation to Immortality', value: '35' },
        { label: 'Cyberpunk City', value: '36' },
        { label: 'Dark Romance', value: '37' },
        { label: 'Demon King', value: '38' },
        { label: 'Divine Beasts', value: '39' },
        { label: 'Divine Intervention', value: '40' },
        { label: 'Dystopian Future', value: '41' },
        { label: 'Elite Private School', value: '42' },
        { label: 'Emotional Healing', value: '43' },
        { label: 'Emotional Rollercoaster', value: '44' },
        { label: 'Enemy to Lover', value: '45' },
        { label: 'Ex-Lovers Reuniting', value: '46' },
        { label: 'Exiled Genius Returns', value: '47' },
        { label: 'Exiled Kingdom', value: '48' },
        { label: 'Face-Slapping Moments', value: '49' },
        { label: 'Fake Death', value: '50' },
        { label: 'Fake Lovers', value: '51' },
        { label: 'Fake Relationship', value: '52' },
        { label: 'Family Feud', value: '53' },
        { label: 'Family Secret', value: '54' },
        { label: 'Fighting Against Fate', value: '55' },
        { label: 'Forbidden Desires', value: '56' },
        { label: 'Forbidden Knowledge', value: '57' },
        { label: 'Forbidden Love', value: '58' },
        { label: 'Forbidden Teacher-Student Romance', value: '59' },
        { label: 'Friends to Lovers', value: '60' },
        { label: 'Friends with Benefits', value: '61' },
        { label: 'Game Element Reincarnation', value: '62' },
        { label: 'Game Master', value: '63' },
        { label: 'Genius Prodigy Child', value: '64' },
        { label: 'Genius Protagonist', value: '65' },
        { label: 'Gladiator Arenas', value: '66' },
        { label: 'Groundhog Day', value: '67' },
        { label: 'Hero Falls for Villain', value: '68' },
        { label: 'Hero Saves the Day', value: '69' },
        { label: 'Hero’s Fall from Grace', value: '70' },
        { label: 'Hidden Cultivation', value: '71' },
        { label: 'Hidden Identity', value: '72' },
        { label: 'Hidden Magical World', value: '73' },
        { label: 'Hidden Master', value: '74' },
        { label: 'Hidden Weakness', value: '75' },
        { label: 'High School Drama', value: '76' },
        { label: 'Hopeful Reunion', value: '77' },
        { label: 'Heroic Sacrifice', value: '78' },
        { label: 'Immortal Lover', value: '79' },
        { label: 'Immortal Soul in Mortal Body', value: '80' },
        { label: 'Immortality', value: '81' },
        { label: 'Imperial Palace Politics', value: '82' },
        { label: 'Instant Power Boost', value: '83' },
        { label: 'Inter-Sect Marriage', value: '84' },
        { label: 'Journey to the West', value: '85' },
        { label: 'Jealous Lover', value: '86' },
        { label: 'Leaving the Sect', value: '87' },
        { label: 'Legendary Hero’s Descendant', value: '88' },
        { label: 'Long-Distance Relationship', value: '89' },
        { label: 'Long-Lost Love', value: '90' },
        { label: 'Lonely Heroine', value: '91' },
        { label: 'Lost Civilizations', value: '92' },
        { label: 'Lost Memories', value: '93' },
        { label: 'Love After Marriage', value: '94' },
        { label: 'Love Dodecahedron', value: '95' },
        { label: 'Love-Hate Relationship', value: '96' },
        { label: 'Love Potion', value: '97' },
        { label: 'Love Triangle', value: '98' },
        { label: 'Loner Protagonist', value: '99' },
        { label: 'Loyal Retainer', value: '100' },
        { label: 'Mafia Family', value: '101' },
        { label: 'Magic Contract', value: '102' },
        { label: 'Male Lead Falls First', value: '103' },
        { label: 'Male to female', value: '104' },
        { label: 'Married to the Enemy', value: '105' },
        { label: 'Martial Arts Genius', value: '106' },
        { label: 'Martial Arts Tournament', value: '107' },
        { label: 'Memory Loss', value: '108' },
        { label: 'Mentor-Student Relationship', value: '109' },
        { label: 'Miscommunication', value: '110' },
        { label: 'Misunderstood Heroine', value: '111' },
        { label: 'Misunderstood Love', value: '112' },
        { label: 'Modern Day with Magic', value: '113' },
        { label: 'Mysterious Powers Awaken', value: '114' },
        { label: 'Mysterious Teacher', value: '115' },
        { label: 'Necromancer', value: '116' },
        { label: 'NTR', value: '117' },
        { label: 'One-Night Stand', value: '118' },
        { label: 'OP Protagonist in Secret', value: '119' },
        { label: 'OP Protagonist', value: '120' },
        { label: 'Overly Affectionate Lover', value: '121' },
        { label: 'Overcoming Trauma', value: '122' },
        { label: 'Overprotective Brother', value: '123' },
        { label: 'Parallel Lives', value: '124' },
        { label: 'Parallel Universe', value: '125' },
        { label: 'Parent-Child Relationship', value: '126' },
        { label: 'Passionate Lovers', value: '127' },
        { label: 'Path of Ascension', value: '128' },
        { label: 'Phantom Thief', value: '129' },
        { label: 'Poor-to-Rich Development', value: '130' },
        { label: 'Power Couple', value: '131' },
        { label: 'Power Ranking System', value: '132' },
        { label: 'Power Surge', value: '133' },
        { label: 'Prodigy Protagonist', value: '134' },
        { label: 'Prophecy Child', value: '135' },
        { label: 'Prophecy Fulfillment', value: '136' },
        { label: 'Protective Lover', value: '137' },
        { label: 'Protagonist Hiding Strength', value: '138' },
        { label: 'Quest for Power', value: '139' },
        { label: 'Redemption Arc', value: '140' },
        { label: 'Rebirth After Death', value: '141' },
        { label: 'Reluctant Romance', value: '142' },
        { label: 'Reincarnated Hero', value: '143' },
        { label: 'Resurrection after 1000 Years', value: '144' },
        { label: 'Revenge Plot', value: '145' },
        { label: 'Rich & Famous', value: '146' },
        { label: 'Rich Heroine/Poor Protagonist', value: '147' },
        { label: 'Rising from Ashes', value: '148' },
        { label: 'Rival Siblings in Love', value: '149' },
        { label: 'Rival Turned Ally', value: '150' },
        { label: 'Royalty Disguised as Commoner', value: '151' },
        { label: 'Ruthless Protagonist', value: '152' },
        { label: 'Secret Admirer', value: '153' },
        { label: 'Secret Crush', value: '154' },
        { label: 'Secret Heir', value: '155' },
        { label: 'Secret Organizations', value: '156' },
        { label: 'Secret Training Arc', value: '157' },
        { label: 'Second Chance Romance', value: '158' },
        { label: 'Sect Wars', value: '159' },
        { label: 'Shamanism', value: '160' },
        { label: 'Shapeshifting', value: '161' },
        { label: 'Slow Burn Romance', value: '162' },
        { label: 'Slow Progression', value: '163' },
        { label: 'Small Village Life', value: '164' },
        { label: 'Soulmate Mark', value: '165' },
        { label: 'Space Opera', value: '166' },
        { label: 'Spirit Companion', value: '167' },
        { label: 'Steampunk City', value: '168' },
        { label: 'Stalker Male Lead', value: '169' },
        { label: 'Sudden Inheritance', value: '170' },
        { label: 'Summoner', value: '171' },
        { label: 'Supernatural Academy', value: '172' },
        { label: 'Sword Saint', value: '173' },
        { label: 'System Administrator', value: '174' },
        { label: 'System Leveling Up', value: '175' },
        { label: 'Time Loop', value: '176' },
        { label: 'Time Travel', value: '177' },
        { label: 'Tomboy', value: '178' },
        { label: 'Tower of Trials', value: '179' },
        { label: 'Tragic Ending', value: '180' },
        { label: 'Tragic Past', value: '181' },
        { label: 'Training to Perfection', value: '182' },
        { label: 'Tsundere', value: '183' },
        { label: 'Underwater World', value: '184' },
        { label: 'Unforeseen Betrayal', value: '185' },
        { label: 'Unlikely Allies', value: '186' },
        { label: 'Unspoken Feelings', value: '187' },
        { label: 'Unwanted Marriage', value: '188' },
        { label: 'Unsealing Forbidden Power', value: '189' },
        { label: 'Underdog Hero', value: '190' },
        { label: 'Unexpected Engagement', value: '191' },
        { label: 'Virtual Reality Game', value: '192' },
        { label: 'Villainess', value: '193' },
        { label: 'Villainess Reborn', value: '194' },
        { label: 'Yandere', value: '195' },
        { label: 'Zombie Apocalypse', value: '196' },
        { label: 'Translate', value: '197' },
        { label: 'Misunderstood', value: '198' },
        { label: 'sub-Romance', value: '199' },
        { label: 'Sarcastic male lead', value: '200' },
        { label: 'Modern fantasy', value: '201' },
        { label: 'Ninja', value: '202' },
        { label: 'Magic', value: '203' },
        { label: 'Reincarnated', value: '204' },
        { label: 'Monster', value: '205' },
        { label: 'Beasts', value: '206' },
        { label: 'Original Character', value: '207' },
        { label: 'R-15', value: '208' },
        { label: 'Brainwashing', value: '209' },
        { label: 'Psychological BL', value: '210' },
        { label: 'psychopath Protagonist', value: '211' },
        { label: 'Evil protagonist', value: '212' },
        { label: 'psychopath Female lead', value: '213' },
        { label: 'Evil Female Lead', value: '214' },
        { label: 'Off-screen Sex', value: '215' },
        { label: 'Gag Characters', value: '216' },
        { label: 'Gag Comedy', value: '217' },
        { label: 'Dungeons', value: '218' },
        { label: 'Bad End Avoidance', value: '219' },
        { label: 'dominated Male Lead', value: '220' },
        { label: 'Domination', value: '221' },
        { label: 'OP Male Lead', value: '222' },
        { label: 'Sexual active male lead', value: '223' },
        { label: 'Submissive Female Lead', value: '224' },
        { label: 'Threesome', value: '225' },
        { label: 'Sex', value: '226' },
        { label: 'Humiliation', value: '227' },
        { label: 'Submission after Resisting', value: '228' },
        { label: 'netorase', value: '229' },
        { label: 'Straightening a Lesbian', value: '230' },
        { label: 'Reverse Yuri', value: '231' },
        { label: 'R-18', value: '232' },
        { label: 'Anti-hero Male Lead', value: '233' },
        { label: 'Anti-hero', value: '234' },
        { label: 'Anti-hero Female Lead', value: '235' },
        { label: 'Evil Male Lead', value: '236' },
        { label: 'Muscle-Brained Protagonist', value: '237' },
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

    // Check if any filters are active besides default sorting
    const areFiltersSet =
      filters.genres.value.included.length > 0 ||
      filters.genres.value.excluded.length > 0 ||
      filters.tags.value.included.length > 0 ||
      filters.tags.value.excluded.length > 0 ||
      filters.story_types.value.length > 0 ||
      filters.story_origin.value !== 'all' ||
      filters.status_filter.value !== 'all' ||
      filters.genre_logic.value !== 'AND' ||
      filters.tag_logic.value !== 'AND' ||
      filters.story_type_logic.value !== 'OR' ||
      (showLatestNovels ? false : filters.sort_by.value !== 'date');

    // If no filters are set and it's the first page, fetch from home page
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

    // Otherwise, build URL for advanced search
    const url = new URL(this.site + '/advanced-search/');
    url.searchParams.set('page', pageNo.toString());

    // Set picker values
    url.searchParams.set('sort_by', filters.sort_by.value);
    url.searchParams.set('sort_order', filters.sort_order.value);
    url.searchParams.set('status_filter', filters.status_filter.value);
    url.searchParams.set('story_origin', filters.story_origin.value);

    // Set logic values
    url.searchParams.set('genre_logic', filters.genre_logic.value);
    url.searchParams.set('tag_logic', filters.tag_logic.value);
    url.searchParams.set('story_type_logic', filters.story_type_logic.value);

    // Set included/excluded genres
    filters.genres.value.included.forEach(val =>
      url.searchParams.append('genres', val),
    );
    filters.genres.value.excluded.forEach(val =>
      url.searchParams.append('exclude_genres', val),
    );

    // Set included/excluded tags
    filters.tags.value.included.forEach(val =>
      url.searchParams.append('tags', val),
    );
    filters.tags.value.excluded.forEach(val =>
      url.searchParams.append('exclude_tags', val),
    );

    // Set story types
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
