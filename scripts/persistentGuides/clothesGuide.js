/**
 * @file Contains the logic for the Clothes option in the Persistent Guides menu.
 */

/**
 * Executes the Clothes Guide script to create a detailed description of what each character is wearing.
 * This helps maintain visual consistency throughout the chat.
 * @param {boolean} isAuto - Whether this guide is being auto-triggered (true) or called directly from menu (false)
 */
const clothesGuide = (isAuto = false) => {
    console.log('[GuidedGenerations] Clothes Guide ' + (isAuto ? 'auto-triggered' : 'button clicked'));

    let stscriptCommand = `/listinjects return=object | 
/let injections {{pipe}} | 
/let x {{var::injections}} | 
/var index=clothes x | 
/let y {{pipe}} | 
/var index=value y |
/inject id=clothes position=chat depth=4 [Relevant Informations for portraying characters {{pipe}}] |

// Get the currently active preset|
/preset|
/setvar key=currentPreset {{pipe}} |

// If current preset is already GGSytemPrompt, do NOT overwrite oldPreset|
/if left={{getvar::currentPreset}} rule=neq right="GGSytemPrompt" {:
   // Store the current preset in oldPreset|
   /setvar key=oldPreset {{getvar::currentPreset}} |
   // Now switch to GGSytemPrompt|
   /preset GGSytemPrompt |
:}|

/gen as=char [OOC: Answer me out of Character! Considering where we are currently in the story, write me a list entailing the clothes and look, what they are currently wearing of all participating characters, including {{user}}, that are present in the current scene. Don't mention People or clothing pieces who are no longer relevant to the ongoing scene.]  |

/inject id=clothes position=chat depth=1 [Relevant Informations for portraying characters {{pipe}}] |

// Switch back to the original preset|
/preset {{getvar::oldPreset}} |`;

    // Only include /listinjects if not auto-triggered
    if (!isAuto) {
        console.log('[GuidedGenerations] Running in manual mode, adding /listinjects command');
        stscriptCommand += `
/listinjects |`;
    } else {
        console.log('[GuidedGenerations] Running in auto mode, NOT adding /listinjects command');
    }

    console.log(`[GuidedGenerations] Executing Clothes Guide stscript: ${isAuto ? 'auto mode' : 'manual mode'}`);

    // Print the full command for debugging
    console.log(`[GuidedGenerations] Clothes Guide final stscript (isAuto=${isAuto}):`);
    console.log(stscriptCommand);

    // Use the context executeSlashCommandsWithOptions method
    if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
        const context = SillyTavern.getContext();
        try {
            // Send the combined script via context
            context.executeSlashCommandsWithOptions(stscriptCommand, { showOutput: false }); // Keep output hidden
            console.log('[GuidedGenerations] Clothes Guide stscript executed.');
        } catch (error) {
            console.error(`[GuidedGenerations] Error executing Clothes Guide stscript: ${error}`);
        }
    } else {
        console.error('[GuidedGenerations] SillyTavern context is not available.');
    }
    return true;
};

// Export the function for use in the main extension file
export default clothesGuide;
