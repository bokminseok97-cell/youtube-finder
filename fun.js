// ===== 심심할 때 랜덤 추천 =====
const form = document.querySelector('#search-form');
const input = document.querySelector('#search');
const list = document.querySelector('#channel-list');
const statusText = document.querySelector('#status');
const topicText = document.querySelector('#topic');
const moodButtons = document.querySelectorAll('.mood-btn');
const randomButton = document.querySelector('#random-btn');

// 기분별 추천 주제 (자유롭게 추가·수정해도 돼요)
const MOODS = {
  laugh: ['웃긴 동물', '코미디 스케치', '몰래카메라', '웹드라마'],
  healing: ['캠핑 브이로그', '자연 ASMR', '시골 일상', '요리 브이로그'],
  focus: ['세계 미스터리', '다큐멘터리', '역사 이야기', '여행 다큐'],
  learn: ['과학 실험', '우주 이야기', '경제 상식', '심리학 이야기']
};

// 직접 검색
form.addEventListener('submit', function (event) {
  event.preventDefault();
  const keyword = input.value.trim();
  if (keyword) runSearch(keyword);
});

// 기분 버튼 → 그 기분의 주제 중 하나를 랜덤으로
moodButtons.forEach(function (button) {
  button.addEventListener('click', function () {
    const topics = MOODS[button.dataset.mood];
    runSearch(pickRandom(topics));
  });
});

// 아무거나 → 전체 주제 중 랜덤
randomButton.addEventListener('click', function () {
  const allTopics = Object.values(MOODS).flat();
  runSearch(pickRandom(allTopics));
});

async function runSearch(keyword) {
  input.value = keyword;
  topicText.textContent = '🎯 추천 주제: ' + keyword;
  list.innerHTML = '';
  showStatus('유튜브에서 찾는 중이에요...');

  try {
    const channels = await searchChannels(keyword);
    if (channels.length === 0) {
      showStatus('찾는 채널이 없어요. 다른 버튼을 눌러보세요.');
      return;
    }
    hideStatus();
    shuffle(channels).slice(0, 9).forEach(function (channel) {
      list.appendChild(createCard(channel));
    });
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

function createCard(channel) {
  const info = channel.snippet;
  const stats = channel.statistics;
  const views = Number(stats.viewCount) || 0;
  const videos = Number(stats.videoCount) || 0;

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
      <li><strong class="avg"></strong><span>평균 조회수</span></li>
    </ul>
    <p class="desc"></p>
  `;

  card.querySelector('.avatar-img').src = info.thumbnails.default.url;
  card.querySelector('h2').textContent = info.title;
  card.querySelector('.tag').textContent = info.customUrl || '유튜브 채널';
  card.querySelector('.subs').textContent = stats.hiddenSubscriberCount ? '비공개' : formatNumber(stats.subscriberCount);
  card.querySelector('.videos').textContent = formatNumber(videos) + '개';
  card.querySelector('.avg').textContent = formatNumber(videos > 0 ? Math.round(views / videos) : 0);
  card.querySelector('.desc').textContent = info.description || '채널 소개가 없어요.';

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