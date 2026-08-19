const sections = [...document.querySelectorAll('.page-section')];
const navLinks = [...document.querySelectorAll('[data-section]')];
const pageLabel = document.querySelector('#page-label');
const sidebar = document.querySelector('.sidebar');
const labels = { inicio: 'Visão geral', biblia: 'Leitura bíblica', planos: 'Planos de leitura', estudos: 'Estudos' };

function openSection(id) {
  sections.forEach((section) => section.classList.toggle('active', section.id === id));
  navLinks.forEach((link) => link.classList.toggle('active', link.dataset.section === id));
  pageLabel.textContent = labels[id] || 'Verbo';
  sidebar.classList.remove('open');
}

navLinks.forEach((link) => link.addEventListener('click', () => openSection(link.dataset.section)));
document.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', () => {
  const id = link.getAttribute('href').slice(1);
  if (document.getElementById(id)) openSection(id);
}));

document.querySelector('#menu-toggle').addEventListener('click', () => sidebar.classList.toggle('open'));
const dialog = document.querySelector('#search-dialog');
document.querySelector('#search-button').addEventListener('click', () => dialog.showModal());
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); dialog.showModal(); } });
let fontSize = 22;
document.querySelector('#font-plus').addEventListener('click', () => { fontSize = Math.min(28, fontSize + 1); document.querySelector('#scripture').style.fontSize = `${fontSize}px`; });
document.querySelector('#font-minus').addEventListener('click', () => { fontSize = Math.max(17, fontSize - 1); document.querySelector('#scripture').style.fontSize = `${fontSize}px`; });
document.querySelector('#complete-chapter').addEventListener('click', (event) => { event.currentTarget.textContent = '✓ Capítulo concluído'; event.currentTarget.disabled = true; });
document.querySelector('#theme-toggle').addEventListener('click', () => document.body.classList.toggle('dark'));
