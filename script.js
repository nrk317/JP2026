(function () {
  const links = Array.from(document.querySelectorAll('.nav__link'));
  const here = location.pathname.split('/').pop() || 'index.html';
  links.forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.endsWith(here)) a.classList.add('is-active');
  });
})();
