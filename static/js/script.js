// Core classes and utilities
let formTouched = false;

document.addEventListener('input', () => {
    formTouched = true;
});
class FormHandler {
    static getFormData() {
        const data = {
            sourceName: document.getElementById('sourceName').value.trim(),
            urls: Array.from(document.querySelectorAll('#urlContainer input[type="url"]'))
                .map(input => input.value.trim())
                .filter(url => url),
            newsSelector: document.getElementById('newsSelector').value.trim(),
            newsLinkSelector: document.getElementById('newsLinkSelector').value.trim()
        };

        // List page selectors
        ['title', 'published_date', 'abstract', 'content', 'author', 'attachments'].forEach(field => {
            const value = document.getElementById(`selector_${field}`)?.value.trim();
            if (value) {
                data[`selector_${field}`] = this.formatSelector(value);
            }
        });

        // Detail page selectors
        ['title', 'article_date', 'content', 'author', 'attachments'].forEach(field => {
            const value = document.getElementById(`news_selector_${field}`)?.value.trim();
            if (value) {
                data[`news_selector_${field}`] = this.formatSelector(value);
            }
        });

        // Advanced options
        const render = document.getElementById('render').checked;
        if (render) data.render = true;

        // Get proxy type and set the appropriate flag
        const proxyType = document.getElementById('proxy_type').value;
        if (proxyType === 'premium') {
            data.premium_proxy = true;
        } else if (proxyType === 'stealth') {
            data.stealth_proxy = true;
        }
        // Classic is default, so no flag needed

        const waitBrowser = document.getElementById('wait_browser').value;
        if (waitBrowser) data.wait_browser = waitBrowser;

        const wait = document.getElementById('wait').value;
        if (wait) data.wait = parseInt(wait);

        const waitFor = document.getElementById('wait_for').value.trim();
        if (waitFor) data.wait_for = waitFor;

        // Handle headers and cookies
        ['headers', 'cookies'].forEach(field => {
            const value = document.getElementById(field)?.value.trim();
            if (value && this.isValidJSON(value)) {
                data[field] = JSON.parse(value);
            }
        });

        return data;
    }

    static formatSelector(selector) {
        return selector.startsWith('.') || selector.startsWith('/') ? selector : '.' + selector;
    }

    static validate() {
        // Skip validation on initial load or if form is untouched
        if (isInitialLoad || !this.formTouched) return true;

        const errors = [];
        const data = this.getFormData();

        if (!data.sourceName) {
            errors.push({ field: 'sourceName', message: 'Source name is required' });
        }

        if (data.urls.length === 0) {
            errors.push({ field: 'urlContainer', message: 'At least one URL is required' });
        }

        if (!data.newsSelector) {
            errors.push({ field: 'newsSelector', message: 'News selector is required' });
        }

        if (!data.newsLinkSelector) {
            errors.push({ field: 'newsLinkSelector', message: 'News link selector is required' });
        }

        if (errors.length > 0) {
            errors.forEach(error => this.showFieldError(error.field, error.message));
            Toast.show(errors[0].message, 'error');
            return false;
        }

        return true;
    }

    static showFieldError(fieldId, message) {
        const element = document.getElementById(fieldId);
        if (!element) return;

        element.classList.add('error');

        // Add error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ${message}
        `;

        const existingError = element.parentNode.querySelector('.error-message');
        if (existingError) existingError.remove();
        element.parentNode.appendChild(errorDiv);

        // Remove error state on input
        element.addEventListener('input', function handler() {
            element.classList.remove('error');
            errorDiv.remove();
            element.removeEventListener('input', handler);
        });
    }

    static isValidJSON(str) {
        if (!str.trim()) return false;
        try {
            const result = JSON.parse(str);
            return result && typeof result === 'object';
        } catch (e) {
            return false;
        }
    }
}

class URLManager {
    static createUrlInput() {
        const urlContainer = document.getElementById('urlContainer');
        const group = document.createElement('div');
        group.className = 'url-input-group slide-in';

        group.innerHTML = `
            <input type="url" class="form-input" placeholder="Enter URL" required>
            <button type="button" class="remove-url" aria-label="Remove URL">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        `;

        const input = group.querySelector('input');
        const removeButton = group.querySelector('.remove-url');

        input.addEventListener('input', () => {
            debouncedUpdatePreview();
            this.validateUrl(input);
        });

        removeButton.addEventListener('click', () => this.removeUrlInput(group));
        urlContainer.appendChild(group);
        return input;
    }

    static validateUrl(input) {
        const url = input.value.trim();
        if (url && !url.match(/^https?:\/\/.+/)) {
            input.classList.add('error');
            FormHandler.showFieldError(input.id || 'url-input', 'Please enter a valid URL starting with http:// or https://');
        } else {
            input.classList.remove('error');
        }
    }

    static removeUrlInput(group) {
        const urlContainer = document.getElementById('urlContainer');
        if (urlContainer.children.length > 1) {
            group.classList.add('fade-out');
            setTimeout(() => {
                group.remove();
                debouncedUpdatePreview();
            }, 200);
        }
    }
}

class StateManager {
    static saveState() {
        if (!isInitialLoad) {
            const data = FormHandler.getFormData();
            localStorage.setItem('scraper-config', JSON.stringify(data));
            localStorage.setItem('scraper-config-timestamp', Date.now().toString());
        }
    }

    static loadState() {
        const savedData = localStorage.getItem('scraper-config');
        const savedTimestamp = localStorage.getItem('scraper-config-timestamp');

        if (savedData && savedTimestamp) {
            const age = Date.now() - parseInt(savedTimestamp);
            if (age < 24 * 60 * 60 * 1000) {
                try {
                    const data = JSON.parse(savedData);
                    this.restoreFormState(data);
                } catch (e) {
                    console.warn('Failed to restore saved data:', e);
                    URLManager.createUrlInput();
                }
            } else {
                this.clearState();
                URLManager.createUrlInput();
            }
        } else {
            URLManager.createUrlInput();
        }
    }

    static restoreFormState(data) {
        // Restore basic fields
        document.getElementById('sourceName').value = data.sourceName || '';
        document.getElementById('newsSelector').value = data.newsSelector || '';
        document.getElementById('newsLinkSelector').value = data.newsLinkSelector || '';

        // Restore URLs
        const urlContainer = document.getElementById('urlContainer');
        urlContainer.innerHTML = '';
        if (data.urls && data.urls.length) {
            data.urls.forEach(url => {
                const input = URLManager.createUrlInput();
                input.value = url;
            });
        } else {
            URLManager.createUrlInput();
        }

        // Restore other fields
        ['title', 'published_date', 'abstract', 'content', 'author', 'attachments'].forEach(field => {
            const value = data[`selector_${field}`];
            const element = document.getElementById(`selector_${field}`);
            if (element && value) element.value = value;
        });

        ['title', 'article_date', 'content', 'author', 'attachments'].forEach(field => {
            const value = data[`news_selector_${field}`];
            const element = document.getElementById(`news_selector_${field}`);
            if (element && value) element.value = value;
        });

        // Restore advanced options
        if (data.render) document.getElementById('render').checked = true;

        // Restore proxy type
        if (data.premium_proxy) {
            document.getElementById('proxy_type').value = 'premium';
        } else if (data.stealth_proxy) {
            document.getElementById('proxy_type').value = 'stealth';
        } else {
            document.getElementById('proxy_type').value = 'classic';
        }

        if (data.wait_browser) document.getElementById('wait_browser').value = data.wait_browser;
        if (data.wait) document.getElementById('wait').value = data.wait;
        if (data.wait_for) document.getElementById('wait_for').value = data.wait_for;
        if (data.headers) document.getElementById('headers').value = JSON.stringify(data.headers, null, 2);
        if (data.cookies) document.getElementById('cookies').value = JSON.stringify(data.cookies, null, 2);
    }

    static clearState() {
        localStorage.removeItem('scraper-config');
        localStorage.removeItem('scraper-config-timestamp');
    }
}

class ConfigManager {
    static updatePreview() {
        // Don't make requests during initial load
        if (isInitialLoad) return;

        // Cache the current form state
        const currentState = JSON.stringify(FormHandler.getFormData());

        // Skip if nothing has changed
        if (this.lastState === currentState) return;
        this.lastState = currentState;

        if (!FormHandler.validate()) return;

        const formData = FormHandler.getFormData();
        const previewPanel = document.querySelector('.preview-panel');

        previewPanel.classList.add('loading');

        fetch('/generate_config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            // Create a custom ordered stringification that preserves the order we want
            const orderedData = orderConfigObject(data);
            configPreview.setValue(orderedData);
            StateManager.saveState();
        })
        .catch(error => {
            console.error('Error updating preview:', error);
            Toast.show('Failed to generate configuration', 'error');
        })
        .finally(() => {
            previewPanel.classList.remove('loading');
        });
    }

    static copyConfig() {
        const config = configPreview.getValue();
        navigator.clipboard.writeText(config)
            .then(() => {
                const copyBtn = document.getElementById('copyConfigBtn');
                copyBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    Copied!
                `;
                setTimeout(() => {
                    copyBtn.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/>
                        </svg>
                        Copy Config
                    `;
                }, 2000);
                Toast.show('Configuration copied to clipboard');
            })
            .catch(() => Toast.show('Failed to copy configuration', 'error'));
    }

    static clearForm() {
        document.getElementById('configForm').reset();
        const urlContainer = document.getElementById('urlContainer');
        urlContainer.innerHTML = '';
        URLManager.createUrlInput();
        StateManager.clearState();
        isInitialLoad = false;
        configPreview.setValue(''); // Clear the preview
        Toast.show('Form cleared');
    }
}

// Function to order the object properties in our preferred order
// Note: This is defined as a global function, not as a method of ConfigManager
function orderConfigObject(data) {
    const sourceName = Object.keys(data)[0];
    if (!sourceName) return JSON.stringify(data, null, 2);

    const source = data[sourceName];

    // Define the order of properties
    const propertyOrder = [
        "type",
        "url",
        "render",
        "wait",
        "wait_browser",
        "wait_for",
        "premium_proxy",
        "stealth_proxy",
        "selectors",
        "news_selector",
        "cookies",
        "headers"
    ];

    // Create a new ordered object
    const ordered = {};
    ordered[sourceName] = {};

    // Add properties in our specified order
    propertyOrder.forEach(prop => {
        if (source.hasOwnProperty(prop)) {
            ordered[sourceName][prop] = source[prop];
        }
    });

    // Add any remaining properties not in our list
    Object.keys(source).forEach(prop => {
        if (!propertyOrder.includes(prop)) {
            ordered[sourceName][prop] = source[prop];
        }
    });

    return JSON.stringify(ordered, null, 2);
}

class TabManager {
    static initialize() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;

                tabButtons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                });
                button.classList.add('active');
                button.setAttribute('aria-selected', 'true');

                tabContents.forEach(content => {
                    content.classList.add('hidden');
                    content.classList.remove('active');
                });

                const activeContent = document.getElementById(`${tab}-content`);
                activeContent.classList.remove('hidden');
                activeContent.classList.add('active');
            });
        });
    }
}

const Toast = {
    show(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} slide-in`;
        toast.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${type === 'success'
                    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>'
                    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'}
            </svg>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Initialize everything when DOM is loaded
let configPreview;
let isInitialLoad = true;
const debouncedUpdatePreview = debounce(ConfigManager.updatePreview, 1000);

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

document.addEventListener('DOMContentLoaded', function() {
   // Initialize CodeMirror
   configPreview = CodeMirror.fromTextArea(document.getElementById('configPreview'), {
       mode: 'javascript',
       theme: 'github',
       lineNumbers: true,
       readOnly: true,
       matchBrackets: true,
       autoCloseBrackets: true,
       tabSize: 4,
       lineWrapping: true,
       foldGutter: true,
       gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
       extraKeys: {
           "Ctrl-Q": function(cm) { cm.foldCode(cm.getCursor()); },
           "Ctrl-Space": "autocomplete"
       },
       indentUnit: 4
   });

   // Initialize tabs
   TabManager.initialize();

   // Set up button handlers
   document.getElementById('copyConfigBtn').addEventListener('click', ConfigManager.copyConfig);
   document.getElementById('clearFormBtn').addEventListener('click', ConfigManager.clearForm);
   document.querySelector('.add-url-btn').addEventListener('click', () => URLManager.createUrlInput());

   // Add input event listeners
   document.querySelectorAll('input, textarea, select').forEach(element => {
       if (!['headers', 'cookies'].includes(element.id)) {
           element.addEventListener('input', debouncedUpdatePreview);
           element.addEventListener('change', debouncedUpdatePreview);
       }
   });

   // JSON validation handlers
   ['headers', 'cookies'].forEach(id => {
       const element = document.getElementById(id);
       if (element) {
           const validateJSONInput = (e) => {
               const input = e.target;
               const value = input.value.trim();

               if (value && !FormHandler.isValidJSON(value)) {
                   input.classList.add('error');
                   FormHandler.showFieldError(id, 'Please enter valid JSON');
               } else {
                   input.classList.remove('error');
                   debouncedUpdatePreview();
               }
           };

           element.addEventListener('input', debounce(validateJSONInput, 500));
           element.addEventListener('blur', validateJSONInput);
       }
   });

   // Restore saved state or initialize new
   StateManager.loadState();

   // Initial preview update
   isInitialLoad = true;
   debouncedUpdatePreview();

   // After initial load completes
   setTimeout(() => {
       isInitialLoad = false;
   }, 500);
});
