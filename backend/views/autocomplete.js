document.addEventListener('DOMContentLoaded', function () {
  const adresseInput = document.querySelector('input[name="adresse"]');
  const suggestionBox = document.createElement('div');
  suggestionBox.style.position = 'absolute';
  suggestionBox.style.background = '#fff';
  suggestionBox.style.border = '1px solid #ccc';
  suggestionBox.style.width = adresseInput.offsetWidth + 'px';
  suggestionBox.style.zIndex = 1000;
  suggestionBox.style.maxHeight = '150px';
  suggestionBox.style.overflowY = 'auto';
  adresseInput.parentNode.appendChild(suggestionBox);

  adresseInput.addEventListener('input', async function () {
    const q = adresseInput.value;
    if (q.length < 3) {
      suggestionBox.innerHTML = '';
      suggestionBox.style.display = 'none';
      return;
    }
    const res = await fetch(`/search-adresse?q=${encodeURIComponent(q)}`);
    const suggestions = await res.json();
    suggestionBox.innerHTML = '';
    suggestions.forEach(s => {
      const div = document.createElement('div');
      div.textContent = s;
      div.style.padding = '6px';
      div.style.cursor = 'pointer';
      div.addEventListener('mousedown', function () {
        adresseInput.value = s;
        suggestionBox.innerHTML = '';
        suggestionBox.style.display = 'none';
      });
      suggestionBox.appendChild(div);
    });
    suggestionBox.style.display = suggestions.length ? 'block' : 'none';
  });

  document.addEventListener('click', function (e) {
    if (e.target !== adresseInput) {
      suggestionBox.innerHTML = '';
      suggestionBox.style.display = 'none';
    }
  });
});
