// public/js/theme-toggle.js
document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('themeToggle');
    const htmlElement = document.documentElement;
    const icon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;

    // Load saved theme
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    
    // UPDATED: Use data-bs-theme for Bootstrap 5.3+
    htmlElement.setAttribute('data-bs-theme', savedTheme);
    updateIcon(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            // UPDATED: Check data-bs-theme
            const currentTheme = htmlElement.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            // UPDATED: Set data-bs-theme
            htmlElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('app-theme', newTheme);
            updateIcon(newTheme);
        });
    }

    function updateIcon(theme) {
        if (!icon) return;
        if (theme === 'dark') {
            icon.classList.remove('bi-moon-stars');
            icon.classList.add('bi-sun');
        } else {
            icon.classList.remove('bi-sun');
            icon.classList.add('bi-moon-stars');
        }
    }
});