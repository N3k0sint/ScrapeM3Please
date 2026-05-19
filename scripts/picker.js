(function() {
    let hoveredElement = null;

    function initStyle() {
        if (document.getElementById('webscraper-styles')) return;
        const head = document.head || document.getElementsByTagName('head')[0];
        if (!head) return; // Still not ready

        const style = document.createElement('style');
        style.id = 'webscraper-styles';
        style.textContent = `
            .webscraper-highlight {
                outline: 3px solid #ff0055 !important;
                outline-offset: -3px !important;
                cursor: crosshair !important;
                box-shadow: 0 0 10px rgba(255, 0, 85, 0.5) !important;
                transition: all 0.2s ease !important;
            }
            .webscraper-selected {
                outline: 3px solid #00ff88 !important;
                outline-offset: -3px !important;
                background-color: rgba(0, 255, 136, 0.1) !important;
            }
        `;
        head.appendChild(style);
    }

    function getOptimalSelector(el) {
        if (el.tagName.toLowerCase() === 'html' || el.tagName.toLowerCase() === 'body') {
            return el.tagName.toLowerCase();
        }
        
        // Prioritize testing IDs heavily used in modern frameworks (like Expedia, Facebook, etc)
        const testId = el.getAttribute('data-testid') || el.getAttribute('data-stid');
        if (testId) {
            return `${el.tagName.toLowerCase()}[${el.hasAttribute('data-testid') ? 'data-testid' : 'data-stid'}="${testId}"]`;
        }
        
        let selector = el.tagName.toLowerCase();
        
        // Use classes if available to make a generic list selector
        if (el.className && typeof el.className === 'string') {
            const classes = el.className.split(/\s+/).filter(c => 
                c && !c.startsWith('webscraper-') && !c.includes(':') // Avoid our own classes and pseudo-classes
            );
            
            if (classes.length > 0) {
                selector += '.' + classes.join('.');
            }
        }
        
        // If it's a very generic tag like 'div' or 'span' with no classes, try to get the parent context
        if ((selector === 'div' || selector === 'span' || selector === 'a' || selector === 'p') && el.parentElement) {
            const parentSelector = getOptimalSelector(el.parentElement);
            // Only go up one level to avoid overly specific long chains
            selector = parentSelector + ' > ' + selector;
        }
        
        return selector;
    }

    window.__webscraperSelectionMode = false; // Start OFF by default so they can navigate first

    document.addEventListener('mouseover', function(e) {
        if (!window.__webscraperSelectionMode) return;
        initStyle();
        if (hoveredElement) {
            hoveredElement.classList.remove('webscraper-highlight');
        }
        hoveredElement = e.target;
        hoveredElement.classList.add('webscraper-highlight');
    }, true);

    document.addEventListener('mouseout', function(e) {
        if (!window.__webscraperSelectionMode) return;
        if (hoveredElement) {
            hoveredElement.classList.remove('webscraper-highlight');
            hoveredElement = null;
        }
    }, true);

    document.addEventListener('click', function(e) {
        if (!window.__webscraperSelectionMode) return;
        
        e.preventDefault();
        e.stopPropagation();

        const el = e.target;
        const selector = getOptimalSelector(el);
        
        // Remove previous selections
        document.querySelectorAll('.webscraper-selected').forEach(node => {
            node.classList.remove('webscraper-selected');
        });
        
        // Highlight new selections
        const matches = document.querySelectorAll(selector);
        matches.forEach(node => node.classList.add('webscraper-selected'));

        const sampleData = {
            text: el.innerText || el.textContent,
            html: el.innerHTML,
            count: matches.length
        };

        if (window.onElementSelected) {
            window.onElementSelected({ selector, sampleData });
        } else {
            console.warn('onElementSelected not found. Ensure the backend has exposed this function.');
        }

        return false;
    }, true);
})();
