// ===== 협업 유튜버 검색 =====
const form = document.querySelector('#search-form');
const input = document.querySelector('#search');
const list = document.querySelector('#channel-list');
const statusText = document.querySelector('#status');
const countText = document.querySelector('#count');
const sizeButtons = document.querySelectorAll('.filter-btn');
const sortSelect = document.querySelector('#sort');

// 구독자 규모 기준
const SIZE_RANGES = {
  all: [0, Infinity],
  micro: [0, 10000],
  small: [10000, 100000],
  mid: [100000, 1000000],
  big: [1000000, Infinity]
};

let allChannels = [];
let currentSize = 'all';
let hasSearched = false;

// 검색
form.addEventListener('submit', async function (event) {
  event.preventDefault();
  const keyword = input.value.trim();
  if (!keyword) return;

  allChannels = [];
  list.innerHTML = '';
  countText.textContent = '';
  showStatus('유튜브에서 찾는 중이에요...');

  try {
    const channels = await searchChannels(keyword);
    allChannels = channels.map(toChannelData);
    hasSearched = true;
    render();
  } catch (error) {
    console.error(error);
    showStatus('검색 중 문제가 생겼어요: ' + error.message);
  }
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

// 정렬 선택
sortSelect.addEventListener('change', render);

// 유튜브 API로 채널 검색 → 상세 정보 가져오기
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
  const channels = channelData.items || [];
  channels.sort(function (a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
  return channels;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error((data.error && data.error.message) || response.status);
  }
  return data;
}

// API 결과를 쓰기 편한 형태로 정리
function toChannelData(channel, index) {
  const info = channel.snippet;
  const stats = channel.statistics;
  const views = Number(stats.viewCount) || 0;
  const videos = Number(stats.videoCount) || 0;
  const description = info.description || '';
  const emailMatch = description.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);

  return {
    id: channel.id,
    order: index,
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

// 필터 + 정렬 적용해서 화면에 그리기
function render() {
  if (!hasSearched) return;
  list.innerHTML = '';

  if (allChannels.length === 0) {
    countText.textContent = '';
    showStatus('찾는 채널이 없어요. 다른 검색어를 입력해 보세요.');
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
    countText.textContent = '';
    showStatus('이 조건에 맞는 채널이 없어요. 다른 구독자 규모를 선택해 보세요.');
    return;
  }

  hideStatus();
  countText.textContent = '채널 ' + result.length + '개';
  result.forEach(function (c) {
    list.appendChild(createCard(c));
  });
}

// 카드 만들기
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
      <li><strong class="avg"></strong><span>영상당 평균 조회수</span></li>
      <li><strong class="videos"></strong><span>영상 수</span></li>
    </ul>
    <p class="desc"></p>
    <p class="contact"></p>
  `;

  card.querySelector('.avatar-img').src = c.thumbnail;
  card.querySelector('h2').textContent = c.title;
  card.querySelector('.tag').textContent = c.handle;
  card.querySelector('.subs').textContent = c.subscribers === null ? '비공개' : formatNumber(c.subscribers);
  card.querySelector('.avg').textContent = formatNumber(c.avgViews);
  card.querySelector('.videos').textContent = formatNumber(c.videos) + '개';
  card.querySelector('.desc').textContent = c.description;

  const contact = card.querySelector('.contact');
  if (c.email) {
    contact.textContent = '📧 ' + c.email;
  } else {
    contact.textContent = '📧 소개란에 이메일 없음';
    contact.classList.add('none');
  }

  return card;
}

// 숫자를 "3.5만", "2,714만", "1.2억" 형태로
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