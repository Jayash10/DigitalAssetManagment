/**
 * Sidebar Drawer & Collapse Controller
 */
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.querySelector('.sidebar');

    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 992) {
                sidebar.classList.toggle('mobile-open');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });

        // Close mobile drawer when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992 && sidebar.classList.contains('mobile-open')) {
                if (!sidebar.contains(e.target) && e.target !== menuBtn) {
                    sidebar.classList.remove('mobile-open');
                }
            }
        });
    }
});