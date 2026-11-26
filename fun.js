// ===== 심심할 때 랜덤 추천 =====
const form = document.querySelector('#search-form');
const input = document.querySelector('#search');
const list = document.querySelector('#channel-list');
const statusText = document.querySelector('#status');
const countText = document.querySelector('#count');
const moodButtons = document.querySelectorAll('.mood-btn');
const randomButton = document.querySelector('#random-btn');
const sizeButtons = document.querySelectorAll('.size-btn');
const sortSelect = document.querySelector('#sort');

// 기분별 추천 주제 (자유롭게 추가·수정해도 돼요)
const MOODS = {
  laugh: ['웃긴 동물', '코미디 스케치', '몰래카메라', '웹드라마'],
  healing: ['캠핑 브이로그', '자연 ASMR', '시골 일상', '요리 브이로그'],
  focus: ['세계 미스터리', '다큐멘터리', '역사 이야기', '여행 다큐'],
  learn: ['과학 실험', '우주 이야기', '경제 상식', '심리학 이야기']
};

const SIZE_RANGES = {
  all: [0, Infinity],
  micro: [0, 10000],
  small: [10000, 100000],
  mid: [100000, 1000000],
  big: [1000000, Infinity]
};

let allChannels = [];
let currentSize = 'all';
let currentTopic = '';
let hasSearched = false;

// 직접 검색
form.addEventListener('submit', function (event) {
  event.preventDefault();
  const keyword = input.value.trim();
  if (keyword) runSearch(keyword);
});

// 기분 버튼 → 그 기분의 주제 중 하나를 랜덤으로
moodButtons.forEach(function (button) {
  button.addEventListener('click', function () {
    runSearch(pickRandom(MOODS[button.dataset.mood]));
  });
});

// 아무거나 → 전체 주제 중 랜덤
randomButton.addEventListener('click', function () {
  const allTopics = Object.values(MOODS).flat();
  runSearch(pickRandom(allTopics));
});

// 구독자 규모 버튼
sizeButtons.forEach(function (button) {
  button.addEventListener('click', function () {
    sizeButtons.forEach(function (b) { b.classList.remove('active'); });
    button.classList.add('active');
    currentSize = button.dataset.size;
    render();
  });
});

// 정렬
sortSelect.addEventListener('change', render);

async function runSearch(keyword) {
  input.value = keyword;
  currentTopic = keyword;
  allChannels = [];
  list.innerHTML = '';
  countText.textContent = '';
  showStatus('유튜브에서 "' + keyword + '" 채널을 찾는 중이에요...');

  try {
    const channels = await searchChannels(keyword);
    allChannels = shuffle(channels).map(toChannelData);
    hasSearched = true;
    render();
  } catch (error) {
    console.error(error);
    showStatus('검색 중 문제가 생겼어요: ' + error.message);
  }
}

async function searchChannels(query) {
  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'channel',
    q: query,
    maxResults: '25',
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    key: API_KEY
  });
  const searchData = await fetchJson('https://www.googleapis.com/youtube/v3/search?' + searchParams);
  const ids = searchData.items.map(function (item) { return item.id.channelId; });
  if (ids.length === 0) return [];

  const channelParams = new URLSearchParams({
    part: 'snippet,statistics',
    id: ids.join(','),
    key: API_KEY
  });
  const channelData = await fetchJson('https://www.googleapis.com/youtube/v3/channels?' + channelParams);
  return channelData.items || [];
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error((data.error && data.error.message) || response.status);
  }
  return data;
}

function toChannelData(channel, index) {
  const info = channel.snippet;
  const stats = channel.statistics;
  const views = Number(stats.viewCount) || 0;
  const videos = Number(stats.videoCount) || 0;

  return {
    id: channel.id,
    order: index,
    title: info.title,
    handle: info.customUrl || '유튜브 채널',
    thumbnail: info.thumbnails.default.url,
    description: info.description || '채널 소개가 없어요.',
    subscribers: stats.hiddenSubscriberCount ? null : Number(stats.subscriberCount),
    videos: videos,
    avgViews: videos > 0 ? Math.round(views / videos) : 0
  };
}

function render() {
  if (!hasSearched) return;
  list.innerHTML = '';

  if (allChannels.length === 0) {
    countText.textContent = '';
    showStatus('찾는 채널이 없어요. 다른 버튼을 눌러보세요.');
    return;
  }

  const range = SIZE_RANGES[currentSize];
  const result = allChannels.filter(function (c) {
    if (currentSize === 'all') return true;
    return c.subscribers !== null && c.subscribers >= range[0] && c.subscribers < range[1];
  });

  const sortBy = sortSelect.value;
  result.sort(function (a, b) {
    if (sortBy === 'subscribers') return (b.subscribers || 0) - (a.subscribers || 0);
    if (sortBy === 'avgViews') return b.avgViews - a.avgViews;
    return a.order - b.order;
  });

  if (result.length === 0) {
    countText.textContent = '🎯 추천 주제: ' + currentTopic;
    showStatus('이 조건에 맞는 채널이 없어요. 다른 구독자 규모를 선택해 보세요.');
    return;
  }

  hideStatus();
  countText.textContent = '🎯 추천 주제: ' + currentTopic + ' · 채널 ' + result.length + '개';
  result.forEach(function (c) {
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
      <li><strong class="videos"></strong><span>영상 수</span></li>
      <li><strong class="avg"></strong><span>평균 조회수</span></li>
    </ul>
    <p class="desc"></p>
  `;

  card.querySelector('.avatar-img').src = c.thumbnail;
  card.querySelector('h2').textContent = c.title;
  card.querySelector('.tag').textContent = c.handle;
  card.querySelector('.subs').textContent = c.subscribers === null ? '비공개' : formatNumber(c.subscribers);
  card.querySelector('.videos').textContent = formatNumber(c.videos) + '개';
  card.querySelector('.avg').textContent = formatNumber(c.avgViews);
  card.querySelector('.desc').textContent = c.description;

  return card;
}

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