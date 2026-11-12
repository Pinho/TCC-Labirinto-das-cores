(function () {
    const storedTheme = localStorage.getItem('labirinto-theme');
    const preferredTheme = window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    const initialTheme = storedTheme || preferredTheme;

    document.documentElement.dataset.theme = initialTheme;

    function updateToggle(theme) {
        const toggle = document.querySelector('.theme-toggle');
        if (!toggle) return;

        const isLight = theme === 'light';
        toggle.innerHTML = '<span class="theme-icon theme-icon-moon" aria-hidden="true">&#9790;</span>' +
            '<span class="theme-icon theme-icon-sun" aria-hidden="true">&#9728;</span>';
        toggle.setAttribute('aria-label', isLight
            ? 'Ativar modo escuro'
            : 'Ativar modo claro');
        toggle.setAttribute('title', isLight
            ? 'Ativar modo escuro'
            : 'Ativar modo claro');
        toggle.setAttribute('aria-pressed', String(isLight));
    }

    document.addEventListener('DOMContentLoaded', function () {
        const toggle = document.querySelector('.theme-toggle');
        updateToggle(document.documentElement.dataset.theme);

        if (!toggle) return;

        toggle.addEventListener('click', function () {
            const nextTheme = document.documentElement.dataset.theme === 'light'
                ? 'dark'
                : 'light';

            document.documentElement.dataset.theme = nextTheme;
            localStorage.setItem('labirinto-theme', nextTheme);
            updateToggle(nextTheme);
            document.dispatchEvent(new CustomEvent('themechange', {
                detail: { theme: nextTheme }
            }));
        });
    });
})();
