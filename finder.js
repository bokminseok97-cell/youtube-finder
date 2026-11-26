// ===== 유튜브 파인더 공통 검색 엔진 =====
// 각 페이지의 window.PAGE 설정을 읽어서 동작해요.
const SETTINGS = window.PAGE || {};
const SUFFIX = SETTINGS.suffix || '';
const MOODS = SETTINGS.moods || {};
const SHOW_EMAIL = SETTINGS.showEmail === true;
const VIDEO_LABEL = SETTINGS.videoLabel || '영상 수';
const AVG_LABEL = SETTINGS.avgLabel || '평균 조회수';

// ===== 공통 설정 (숫자만 바꿔서 조절할 수 있어요) =====
const SHOW_COUNT = 20;          // 한 번에 보여줄 채널 수
const MIN_SUBSCRIBERS = 10000;  // 최소 구독자 수
const MAX_PAGES = 3;            // 검색어 하나당 유튜브에서 불러올 최대 횟수 (1번 = 50개)

const SIZE_RANGES = {
  all: [MIN_SUBSCRIBERS, Infinity],
  small: [10000, 100000],
  mid: [100000, 1000000],
  big: [1000000, Infinity]
};

// ===== 화면 요소 =====
const form = document.querySelector('#search-form');
const input = document.querySelector('#search');
const list = document.querySelector('#channel-list');
const statusText = document.querySelector('#status');
const countText = document.querySelector('#count');
const resultBar = document.querySelector('.result-bar');
const moodButtons = document.querySelectorAll('.mood-btn');
const randomButton = document.querySelector('#random-btn');
const sizeButtons = document.querySelectorAll('.size-btn');
const sortSelect = document.querySelector('#sort');
const rerollButtons = document.querySelectorAll('.reroll-btn');

// ===== 상태 =====
let pool = [];              // 받아온 후보 채널 (1만 이상만)
let nextPageToken = null;
let pagesLoaded = 0;
let currentTopic = '';
let currentQuery = '';
let currentSize = 'all';
let offset = 0;             // 지금 몇 번째부터 보여주는지
let hasSearched = false;
let isLoading = false;

// ===== 버튼 연결 =====
form.addEventListener('submit', function (event) {
  event.preventDefault();
  const keyword = input.value.trim();
  if (keyword) runSearch(keyword);
});

moodButtons.forEach(function (button) {
  button.addEventListener('click', function () {
    runSearch(pickRandom(MOODS[button.dataset.mood]));
  });
});

if (randomButton) {
  randomButton.addEventListener('click', function () {
    runSearch(pickRandom(Object.values(MOODS).flat()));
  });
}

sizeButtons.forEach(function (button) {
  button.addEventListener('click', function () {
    sizeButtons.forEach(function (b) { b.classList.remove('active'); });
    button.classList.add('active');
    currentSize = button.dataset.size;
    offset = 0;
    render();
  });
});

sortSelect.addEventListener('change', function () {
  offset = 0;
  render();
});

rerollButtons.forEach(function (button) {
  button.addEventListener('click', reroll);
});

// ===== 새로 검색 =====
async function runSearch(keyword) {
  if (isLoading) return;

  input.value = keyword;
  currentTopic = keyword;
  currentQuery = keyword + SUFFIX;
  pool = [];
  nextPageToken = null;
  pagesLoaded = 0;
  offset = 0;
  hasSearched = false;
  list.innerHTML = '';
  countText.textContent = '';
  setRerollVisible(false);
  showStatus('유튜브에서 "' + keyword + '" 채널을 찾는 중이에요...');

  isLoading = true;
  try {
    await fillTo(SHOW_COUNT);
    hasSearched = true;
    render();
  } catch (error) {
    console.error(error);
    showStatus('검색 중 문제가 생겼어요: ' + error.message);
  } finally {
    isLoading = false;
  }
}

// ===== 다른 채널 보기 (다음 20개) =====
async function reroll() {
  if (isLoading || !hasSearched) return;
  offset += SHOW_COUNT;

  isLoading = true;
  try {
    if (sortedResult().length < offset + SHOW_COUNT && canLoadMore()) {
      showStatus('새로운 채널을 더 불러오는 중이에요...');
      await fillTo(offset + SHOW_COUNT);
    }
  } catch (error) {
    console.error(error);
  } finally {
    isLoading = false;
  }

  // 끝까지 다 봤으면 처음부터 다시 섞어서
  if (offset >= sortedResult().length) {
    offset = 0;
    reshuffle();
  }

  render();
  resultBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 조건에 맞는 채널이 needed개가 될 때까지 불러오기
async function fillTo(needed) {
  while (sortedResult().length < needed && canLoadMore()) {
    await loadMore();
  }
}

function canLoadMore() {
  if (pagesLoaded === 0) return true;
  return nextPageToken !== null && pagesLoaded < MAX_PAGES;
}

// 유튜브에서 50개 더 받아오기
async function loadMore() {
  const params = {
    part: 'snippet',
    type: 'channel',
    q: currentQuery,
    maxResults: '50',
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    key: API_KEY
  };
  if (nextPageToken) params.pageToken = nextPageToken;

  const searchData = await fetchJson('https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams(params));
  pagesLoaded++;
  nextPageToken = searchData.nextPageToken || null;

  const existingIds = new Set(pool.map(function (c) { return c.id; }));
  const ids = searchData.items
    .map(function (item) { return item.id.channelId; })
    .filter(function (id) { return id && !existingIds.has(id); });
  if (ids.length === 0) return;

  const channelParams = new URLSearchParams({
    part: 'snippet,statistics',
    id: ids.join(','),
    key: API_KEY
  });
  const channelData = await fetchJson('https://www.googleapis.com/youtube/v3/channels?' + channelParams);

  const newChannels = (channelData.items || [])
    .map(toChannelData)
    .filter(function (c) { return c.subscribers !== null && c.subscribers >= MIN_SUBSCRIBERS; });

  newChannels.sort(function (a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
  const base = pool.length;
  newChannels.forEach(function (c, i) { c.rank = base + i; });            // 관련도 순서
  shuffle(newChannels).forEach(function (c, i) { c.order = base + i; });  // 섞인 순서
  newChannels.forEach(function (c) { pool.push(c); });
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error((data.error && data.error.message) || response.status);
  }
  return data;
}

function toChannelData(channel) {
  const info = channel.snippet;
  const stats = channel.statistics;
  const views = Number(stats.viewCount) || 0;
  const videos = Number(stats.videoCount) || 0;
  const description = info.description || '';
  const emailMatch = description.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);

  return {
    id: channel.id,
    rank: 0,
    order: 0,
    title: info.title,
    handle: info.customUrl || '유튜브 채널',
    thumbnail: info.thumbnails.default.url,
    description: description || '채널 소개가 없어요.',
    subscribers: stats.hiddenSubscriberCount ? null : Number(stats.subscriberCount),
    videos: videos,
    avgViews: videos > 0 ? Math.round(views / videos) : 0,
    email: emailMatch ? emailMatch[0] : null
  };
}

function reshuffle() {
  shuffle(pool).forEach(function (c, i) { c.order = i; });
}

function matchesSize(c) {
  const range = SIZE_RANGES[currentSize];
  return c.subscribers >= range[0] && c.subscribers < range[1];
}

// 구독자 조건 + 정렬 적용한 목록
function sortedResult() {
  const sortBy = sortSelect.value;
  return pool.filter(matchesSize).sort(function (a, b) {
    if (sortBy === 'random') return a.order - b.order;
    if (sortBy === 'subscribers') return b.subscribers - a.subscribers;
    if (sortBy === 'videos') return b.videos - a.videos;
    if (sortBy === 'avgViews') return b.avgViews - a.avgViews;
    return a.rank - b.rank;
  });
}

// ===== 화면 그리기 =====
function render() {
  if (!hasSearched) return;
  list.innerHTML = '';

  if (pool.length === 0) {
    countText.textContent = '';
    setRerollVisible(false);
    showStatus('구독자 1만 명 이상인 채널을 찾지 못했어요. 다른 검색어나 버튼을 눌러보세요.');
    return;
  }

  const result = sortedResult();
  if (result.length === 0) {
    countText.textContent = '🎯 ' + currentTopic;
    setRerollVisible(false);
    showStatus('이 조건에 맞는 채널이 없어요. 다른 구독자 규모를 선택해 보세요.');
    return;
  }

  if (offset >= result.length) offset = 0;
  const shown = result.slice(offset, offset + SHOW_COUNT);

  hideStatus();
  countText.textContent = '🎯 ' + currentTopic + ' · 후보 ' + result.length + '개 중 ' +
    (offset + 1) + '~' + (offset + shown.length) + '번째';
  setRerollVisible(true);

  shown.forEach(function (c) {
    list.appendChild(createCard(c));
  });
}

function createCard(c) {
  const card = document.createElement('a');
  card.className = 'channel';
  card.href = 'https://www.youtube.com/channel/' + c.id;
  card.target = '_blank';
  card.rel = 'noopener';

  card.innerHTML = `
    <div class="channel-top">
      <img class="avatar-img" alt="">
      <div>
        <h2></h2>
        <span class="tag"></span>
      </div>
    </div>
    <ul class="stats">
      <li><strong class="subs"></strong><span>구독자</span></li>
      <li><strong class="videos"></strong><span>${VIDEO_LABEL}</span></li>
      <li><strong class="avg"></strong><span>${AVG_LABEL}</span></li>
    </ul>
    <p class="desc"></p>
  `;

  card.querySelector('.avatar-img').src = c.thumbnail;
  card.querySelector('h2').textContent = c.title;
  card.querySelector('.tag').textContent = c.handle;
  card.querySelector('.subs').textContent = formatNumber(c.subscribers);
  card.querySelector('.videos').textContent = formatNumber(c.videos) + '개';
  card.querySelector('.avg').textContent = formatNumber(c.avgViews);
  card.querySelector('.desc').textContent = c.description;

  if (SHOW_EMAIL) {
    const contact = document.createElement('p');
    contact.className = 'contact';
    if (c.email) {
      contact.textContent = '📧 ' + c.email;
    } else {
      contact.textContent = '📧 소개란에 이메일 없음';
      contact.classList.add('none');
    }
    card.appendChild(contact);
  }

  return card;
}

// ===== 도우미 함수 =====
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatNumber(value) {
  const n = Number(value);
  if (n >= 100000000) {
    return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억';
  }
  if (n >= 10000) {
    const man = n / 10000;
    if (man >= 100) return Math.round(man).toLocaleString() + '만';
    return man.toFixed(1).replace(/\.0$/, '') + '만';
  }
  return n.toLocaleString();
}

function showStatus(message) {
  statusText.textContent = message;
  statusText.style.display = 'block';
}

function hideStatus() {
  statusText.style.display = 'none';
}

function setRerollVisible(visible) {
  rerollButtons.forEach(function (b) { b.hidden = !visible; });
}