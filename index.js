import { eventSource, saveSettingsDebounced } from '../../../../script.js'; // For event handling (will use later)
// Removed the incorrect SillyTavern import

// Import button logic from separate modules
import { simpleSend } from './scripts/simpleSend.js';
import { recoverInput } from './scripts/inputRecovery.js';
import { guidedResponse } from './scripts/guidedResponse.js';
import { guidedSwipe } from './scripts/guidedSwipe.js';
import { guidedImpersonate } from './scripts/guidedImpersonate.js';
import { guidedImpersonate2nd } from './scripts/guidedImpersonate2nd.js'; // Import 2nd
import { guidedImpersonate3rd } from './scripts/guidedImpersonate3rd.js'; // Import 3rd
// Import necessary functions/objects from SillyTavern
import { getContext, loadExtensionSettings, extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js'; 

const extensionName = "guided-generations"; // Use the simple name as the internal identifier
// const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`; // No longer needed

let isSending = false; 
// Removed storedInput as recovery now uses stscript global vars

const defaultSettings = {
    autoTriggerClothes: false, // Default off
    autoTriggerState: false,   // Default off
    autoTriggerThinking: false, // Default off
    showImpersonate1stPerson: true, // Default on
    showImpersonate2ndPerson: false, // Default on
    showImpersonate3rdPerson: false, // Default off
};

/**
 * Checks if the current chat context is a group chat.
 * @returns {boolean} True if it is a group chat, false otherwise.
 */
export function isGroupChat() {
    try {
        const context = getContext(); // Use imported getContext
        return !!context.groupId; // groupId will be a string ID if group, otherwise null/undefined
    } catch (error) {
        console.error(`${extensionName}: Error checking group chat status:`, error);
        return false; // Assume not a group chat on error
    }
}

function loadSettings() {
    // Ensure the settings object exists
    extension_settings[extensionName] = extension_settings[extensionName] || {};

    // Check if settings are already loaded and have keys, otherwise initialize with defaults
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        console.log(`${extensionName}: Initializing settings with defaults.`);
        Object.assign(extension_settings[extensionName], defaultSettings);
    } else {
        console.log(`${extensionName}: Settings already loaded.`);
    }

    // Ensure all default keys exist (migration / update handling)
    for (const key in defaultSettings) {
        if (extension_settings[extensionName][key] === undefined) {
            console.warn(`${extensionName}: Setting key "${key}" missing, adding default value: ${defaultSettings[key]}`);
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }
    console.log(`${extensionName}: Current settings:`, extension_settings[extensionName]);

    // Update UI elements based on loaded settings
    const container = document.getElementById('extension_settings_guided-generations');
    if (container) {
         console.log(`${extensionName}: Updating UI elements from settings.`);
        Object.keys(defaultSettings).forEach(key => {
            const checkbox = container.querySelector(`input[name="${key}"]`);
            if (checkbox) {
                checkbox.checked = extension_settings[extensionName][key];
            } else {
                // This might happen before template is rendered, it's ok.
                // console.warn(`${extensionName}: Could not find checkbox for setting "${key}" during loadSettings.`);
            }
        });
    } else {
         // This might happen before template is rendered, it's ok.
         // console.warn(`${extensionName}: Settings container not found during loadSettings.`);
    }
}

function updateSettingsUI() {
    const settings = extension_settings[extensionName];
    const container = document.getElementById(`extension_settings_${extensionName}`);
    if (!container) {
        //console.error(`${extensionName}: Settings container not found during UI update.`);
        // It's okay if the container isn't ready yet on initial load
        return;
    }

    console.log(`${extensionName}: Updating settings UI...`, settings);
    let uiChanged = false;
    for (const key in settings) {
        const value = settings[key];
        const checkbox = container.querySelector(`input[type="checkbox"][name="${key}"]`);
        if (checkbox) {
            if (checkbox.checked !== Boolean(value)) {
                checkbox.checked = Boolean(value);
                uiChanged = true; // Track if UI actually changed
            }
            //console.log(`${extensionName}: Set checkbox ${key} to ${checkbox.checked}`);
        } else {
            //console.warn(`${extensionName}: Checkbox for setting ${key} not found in UI.`);
        }
    }

    // Only update buttons if the UI relevant to them might have changed
    if (uiChanged) {
         console.log(`${extensionName}: Settings UI changed, updating buttons.`);
         updateExtensionButtons();
    }
}

function addSettingsEventListeners() {
    const container = document.getElementById(`extension_settings_${extensionName}`);
    if (!container) {
        // console.error(`${extensionName}: Settings container not found for adding listeners.`);
        return; // Okay if not ready yet
    }

    // Clear previous listeners if any (simple approach)
    // A more robust way would be to store and remove specific listeners
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    console.log(`${extensionName}: Adding settings event listeners...`);
    Object.keys(extension_settings[extensionName]).forEach(key => {
        const checkbox = newContainer.querySelector(`input[type="checkbox"][name="${key}"]`);
        if (checkbox) {
            checkbox.addEventListener('change', (event) => {
                console.log(`${extensionName}: Setting ${key} changed to ${event.target.checked}`);
                extension_settings[extensionName][key] = event.target.checked;
                saveSettingsDebounced();

                // Update buttons immediately if a relevant setting changed
                if (key.startsWith('showImpersonate')) {
                    updateExtensionButtons();
                }
            });
        } else {
            // console.warn(`${extensionName}: Checkbox for setting ${key} not found for adding listener.`);
        }
    });
    console.log(`${extensionName}: Settings event listeners added.`);
}

// Function to create and add/remove buttons based on settings
function updateExtensionButtons() {
    const settings = extension_settings[extensionName];
    if (!settings) {
        console.error(`${extensionName}: Settings not loaded, cannot update buttons.`);
        return;
    }
    console.log(`${extensionName}: Updating extension buttons based on settings...`, settings);

    // --- Right Side: Action Buttons (Now in Container Below Input) --- 
    const sendForm = document.getElementById('send_form');
    const nonQRFormItems = document.getElementById('nonQRFormItems');

    if (!sendForm || !nonQRFormItems) {
        console.error(`${extensionName}: Could not find #send_form or #nonQRFormItems. Cannot add button container.`);
        return;
    }

    // --- Get or Create the Action Button Container --- 
    let buttonContainer = document.getElementById('gg-action-button-container');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.id = 'gg-action-button-container';
        buttonContainer.className = 'gg-action-buttons-container'; // Add class for styling
        // Insert the container AFTER nonQRFormItems within send_form
        nonQRFormItems.parentNode.insertBefore(buttonContainer, nonQRFormItems.nextSibling);
        console.log(`${extensionName}: Created action button container below input area.`);
    }

    // Clear the container before adding/arranging buttons
    buttonContainer.innerHTML = '';

    // --- Create or Move GG Tools Menu Button (Wand) --- 
    let ggMenuButton = document.getElementById('gg_menu_button');
    if (!ggMenuButton) {
        // Create it for the first time
        ggMenuButton = document.createElement('div');
        ggMenuButton.id = 'gg_menu_button';
        ggMenuButton.className = 'gg-menu-button fa-solid fa-wand-magic-sparkles'; // Base classes
        ggMenuButton.classList.add('interactable'); // Make sure it has interactable styles
        ggMenuButton.title = 'Guided Generations Tools';

        const ggToolsMenu = document.createElement('div');
        ggToolsMenu.id = 'gg_tools_menu';
        ggToolsMenu.className = 'gg-tools-menu'; // Dropdown menu styling

        // Add menu items (Simple Send, Recover Input)
        const simpleSendMenuItem = document.createElement('a');
        simpleSendMenuItem.href = '#';
        simpleSendMenuItem.className = 'interactable'; // Use interactable class
        simpleSendMenuItem.innerHTML = '<i class="fa-solid fa-paper-plane fa-fw"></i><span data-i18n="Simple Send">Simple Send</span>'; // Add icon + span
        simpleSendMenuItem.addEventListener('click', (event) => {
            console.log(`${extensionName}: Simple Send action clicked.`);
            simpleSend();
            ggToolsMenu.classList.remove('shown');
            event.stopPropagation();
        });

        const recoverInputMenuItem = document.createElement('a');
        recoverInputMenuItem.href = '#';
        recoverInputMenuItem.className = 'interactable'; // Use interactable class
        recoverInputMenuItem.innerHTML = '<i class="fa-solid fa-arrow-rotate-left fa-fw"></i><span data-i18n="Recover Input">Recover Input</span>'; // Add icon + span
        recoverInputMenuItem.addEventListener('click', (event) => {
            console.log(`${extensionName}: Recover Input action clicked.`);
            recoverInput();
            ggToolsMenu.classList.remove('shown');
            event.stopPropagation();
        });

        ggToolsMenu.appendChild(simpleSendMenuItem);
        ggToolsMenu.appendChild(recoverInputMenuItem);

        // Append the menu itself to the body, not the button
        document.body.appendChild(ggToolsMenu);

        // Event Handlers for Menu Toggle and Close
        ggMenuButton.addEventListener('click', (event) => {
            console.log(`${extensionName}: ggMenuButton clicked.`);

            // --- Measure Height Correctly ---
            // Temporarily show the menu off-screen to measure its height
            ggToolsMenu.style.visibility = 'hidden'; 
            ggToolsMenu.style.display = 'block'; // Or the display type it uses when shown
            const menuHeight = ggToolsMenu.offsetHeight; 
            ggToolsMenu.style.display = ''; // Reset display before final positioning
            ggToolsMenu.style.visibility = ''; // Reset visibility
            // ---------------------------------

            // Calculate position before showing
            const buttonRect = ggMenuButton.getBoundingClientRect();
            const gap = 5; // Add a 5px gap above the button

            // Calculate Y so the *bottom* of the menu is 'gap' pixels above the button's top
            const targetMenuBottomY = buttonRect.top - gap + window.scrollY;
            const targetMenuTopY = targetMenuBottomY - menuHeight; // This is the final top coordinate
            const targetMenuLeftX = buttonRect.left + window.scrollX;

            // Apply top/left instead of transform
            ggToolsMenu.style.top = `${targetMenuTopY}px`;
            ggToolsMenu.style.left = `${targetMenuLeftX}px`;

            ggToolsMenu.classList.toggle('shown');
            event.stopPropagation();
        });

        document.addEventListener('click', (event) => {
            if (ggToolsMenu.classList.contains('shown') && !ggMenuButton.contains(event.target)) {
                console.log(`${extensionName}: Click outside detected, hiding menu.`);
                ggToolsMenu.classList.remove('shown');
            }
        });
        console.log(`${extensionName}: Created GG Tools menu button.`);
    } 
    // Add menu button to the container first (for left alignment)
    buttonContainer.appendChild(ggMenuButton);

    // --- Create Action Buttons --- 
    // Helper function to create buttons
    const createActionButton = (id, title, iconClass, actionFunc) => {
        const button = document.createElement('div');
        button.id = id;
        button.className = `gg-action-button ${iconClass}`;
        button.title = title;
        button.classList.add('interactable'); // Add interactable class for consistent styling/behavior
        button.addEventListener('click', actionFunc);
        return button;
    };

    // Conditionally create and add buttons
    if (settings.showImpersonate1stPerson) {
        const btn1 = createActionButton('gg_impersonate_button', 'Guided Impersonate (1st Person)', 'fa-solid fa-user', guidedImpersonate);
        buttonContainer.appendChild(btn1); // Add directly to container
    }
    if (settings.showImpersonate2ndPerson) {
        const btn2 = createActionButton('gg_impersonate_button_2nd', 'Guided Impersonate (2nd Person)', 'fa-solid fa-user-group', guidedImpersonate2nd);
        buttonContainer.appendChild(btn2);
    }
    if (settings.showImpersonate3rdPerson) {
        const btn3 = createActionButton('gg_impersonate_button_3rd', 'Guided Impersonate (3rd Person)', 'fa-solid fa-users', guidedImpersonate3rd);
        buttonContainer.appendChild(btn3);
    }

    // Guided Swipe Button (Restore correct icon)
    const guidedSwipeButton = createActionButton('gg_swipe_button', 'Guided Swipe', 'fa-solid fa-forward', guidedSwipe); // Correct icon: fa-forward
    buttonContainer.appendChild(guidedSwipeButton);

    // Guided Response Button (Restore correct icon)
    const guidedResponseButton = createActionButton('gg_response_button', 'Guided Response', 'fa-solid fa-dog', guidedResponse); // Correct icon: fa-dog
    buttonContainer.appendChild(guidedResponseButton);
}

// Initial setup function
function setup() {
    // Initial call to setup buttons based on default/loaded settings
    // Make sure settings are loaded first!
    loadSettings(); // Load settings early
    updateExtensionButtons(); // Then update/create buttons

    // Add listener to update buttons when settings change
    // We need to listen for the save event or similar.
    // Let's try calling updateExtensionButtons after settings are saved.
    // Modifying the saveSettingsDebounced or finding an event might be better later.
}

// Run setup after page load
$(document).ready(function() {
    setup();
    // Settings Panel Setup (runs with delay)
    loadSettingsPanel(); 
});

// --- Settings Panel Loading --- (Keep existing loadSettingsPanel async function)
async function loadSettingsPanel() {
    const containerId = `extension_settings_${extensionName}`;
    let container = document.getElementById(containerId);

    // Check if container exists, create if not (robustness)
    if (!container) {
        console.warn(`${extensionName}: Settings container #${containerId} not found. Creating...`);
        // Find the main settings area in SillyTavern (adjust selector if needed)
        const settingsArea = document.getElementById('extensions_settings'); 
        if (settingsArea) {
            container = document.createElement('div');
            container.id = containerId;
            settingsArea.appendChild(container);
        } else {
            console.error(`${extensionName}: Could not find main settings area to create container.`);
            return; // Stop if we can't create the container
        }
    } else {
        console.log(`${extensionName}: Settings container #${containerId} found.`);
        // Clear previous content if any (important for reloads)
        container.innerHTML = ''; 
    }

    // Use renderExtensionTemplateAsync instead of manual $.get
    try {
        console.log(`${extensionName}: Rendering settings template using renderExtensionTemplateAsync...`);
        // Assuming 'settings' maps to settings.html by convention
        // Use the explicit path identifier for third-party extensions, referencing the root folder
        const settingsHtml = await renderExtensionTemplateAsync(`third-party/${extensionName}`, 'settings'); 
        console.log(`${extensionName}: Settings template rendered successfully.`);
        
        // Append the fetched HTML to the container using jQuery
        $(container).html(settingsHtml); // Use jQuery's .html()
        
        // Defer the rest of the logic slightly to allow DOM update
        setTimeout(() => {
            console.log(`${extensionName}: DOM updated, now loading settings and adding listeners...`);
            // ***** Load settings HERE, right before updating UI *****
            loadSettings(); // Ensure settings are loaded/initialized

            // Update the UI elements to reflect loaded settings
            updateSettingsUI(); 

            // Add event listeners AFTER the HTML is loaded AND UI is updated
            addSettingsEventListeners();
            console.log(`${extensionName}: Settings panel actions complete.`);
        }, 0); // 0ms delay is usually sufficient

    } catch (error) {
        console.error(`${extensionName}: Error rendering settings template with renderExtensionTemplateAsync:`, error);
        if (container) { // Check if container exists before modifying
             container.innerHTML = '<p>Error: Could not render settings template. Check browser console (F12).</p>';
        }
    }
}
