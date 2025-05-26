function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });

  document.querySelectorAll('.tab-link').forEach(link => {
    link.classList.remove('text-blue-600', 'active-tab');
    link.classList.add('text-gray-600');
  });

  document.getElementById(`${tab}-tab`).classList.remove('hidden');
  const activeLink = document.querySelector(`.tab-link[data-tab="${tab}"]`);
  if (activeLink) {
    activeLink.classList.add('text-blue-600', 'active-tab');
    activeLink.classList.remove('text-gray-600');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Gán sự kiện click cho từng tab
  document.querySelectorAll('.tab-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault(); // Tránh nhảy trang
      const tab = link.dataset.tab;
      switchTab(tab);
    });
  });

  // Mặc định hiện tab "users"
  switchTab('users');
});
