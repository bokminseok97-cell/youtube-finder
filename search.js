// 화면에서 필요한 요소들 찾아오기
const searchInput = document.querySelector('#search');
const filterButtons = document.querySelectorAll('.filter-btn');
const cards = document.querySelectorAll('.channel');
const emptyMessage = document.querySelector('#empty');

let currentFilter = '전체';

// 검색어 + 필터 조건에 맞는 카드만 보여주기
function updateCards() {
  const keyword = searchInput.value.trim().toLowerCase();
  let visibleCount = 0;

  cards.forEach(function (card) {
    const cardText = card.textContent.toLowerCase();
    const matchKeyword = cardText.includes(keyword);
    const matchFilter = currentFilter === '전체' || card.dataset.filter === currentFilter;

    if (matchKeyword && matchFilter) {
      card.style.display = '';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  emptyMessage.style.display = visibleCount === 0 ? 'block' : 'none';
}

// 검색창에 글자를 입력할 때마다 실행
searchInput.addEventListener('input', updateCards);

// 필터 버튼을 누를 때마다 실행
filterButtons.forEach(function (button) {
  button.addEventListener('click', function () {
    filterButtons.forEach(function (b) {
      b.classList.remove('active');
    });
    button.classList.add('active');
    currentFilter = button.dataset.filter;
    updateCards();
  });
});
