(function () {
  const links = Array.from(document.querySelectorAll('.nav__link'));
  const sections = links
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  function setActive(id) {
    links.forEach(a => {
      const isActive = a.getAttribute('href') === `#${id}`;
      a.classList.toggle('is-active', isActive);
    });
  }

  const obs = new IntersectionObserver((entries) => {
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visible?.target?.id) setActive(visible.target.id);
  }, {
    threshold: [0.15, 0.25, 0.35, 0.5],
    rootMargin: "-20% 0px -70% 0px"
  });

  sections.forEach(sec => obs.observe(sec));
})();
