// ===== 유튜브 채널 검색 =====
const form = document.querySelector('#search-form');
const input = document.querySelector('#search');
const list = document.querySelector('#channel-list');
const statusText = document.querySelector('#status');

// 검색어 뒤에 붙일 단어 (공부 페이지라서 "강의")
const SEARCH_SUFFIX = ' 강의';

form.addEventListener('submit', async function (event) {
  event.preventDefault();
  const keyword = input.value.trim();
  if (!keyword) return;

  list.innerHTML = '';
  showStatus('유튜브에서 찾는 중이에요...');

  try {
    const channels = await searchChannels(keyword + SEARCH_SUFFIX);
    if (channels.length === 0) {
      showStatus('찾는 채널이 없어요. 다른 검색어를 입력해 보세요.');
      return;
    }
    hideStatus();
    channels.forEach(function (channel) {
      list.appendChild(createCard(channel));
    });
  } catch (error) {
    console.error(error);
    showStatus('검색 중 문제가 생겼어요: ' + error.message);
  }
});

// 1) 검색으로 채널 ID 찾기 → 2) 채널 상세 정보(구독자 등) 가져오기
async function searchChannels(query) {
  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'channel',
    q: query,
    maxResults: '12',
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

  // 검색 결과 순서대로 정렬
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

// 채널 정보로 카드 만들기
function createCard(channel) {
  const info = channel.snippet;
  const stats = channel.statistics;

  const card = document.createElement('a');
  card.className = 'channel';
  card.href = 'https://www.youtube.com/channel/' + channel.id;
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
      <li><strong class="views"></strong><span>총 조회수</span></li>
    </ul>
    <p class="desc"></p>
  `;

  card.querySelector('.avatar-img').src = info.thumbnails.default.url;
  card.querySelector('h2').textContent = info.title;
  card.querySelector('.tag').textContent = info.customUrl || '유튜브 채널';
  card.querySelector('.subs').textContent = stats.hiddenSubscriberCount ? '비공개' : formatNumber(stats.subscriberCount);
  card.querySelector('.videos').textContent = formatNumber(stats.videoCount) + '개';
  card.querySelector('.views').textContent = formatNumber(stats.viewCount);
  card.querySelector('.desc').textContent = info.description || '채널 소개가 없어요.';

  return card;
}

// 숫자를 "12.3만", "1.2억" 형태로
function formatNumber(value) {
  const n = Number(value);
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  return n.toLocaleString();
}

function showStatus(message) {
  statusText.textContent = message;
  statusText.style.display = 'block';
}

function hideStatus() {
  statusText.style.display = 'none';
}
