/**
 * @file Contains the logic for the Custom Guide option in the Persistent Guides menu.
 */

/**
 * Executes the Custom Guide script to let users create their own personal guides.
 * This allows for maximum flexibility in creating specialized context for characters.
 */
const customGuide = () => {
    console.log('[GuidedGenerations] Custom Guide button clicked');

    // Check for existing custom guide to edit |
    const stscriptCommand = `/listinjects return=object | 
/let injections {{pipe}} | 
/let x {{var::injections}} | 
/var index=Custom x | 
/let y {{pipe}} | 
/var index=value y |
/input large=off wide=on rows=20 default={{pipe}} Enter your custom Guide |
/inject id=Custom position=chat depth=1 {{pipe}} |
/listinjects |`;

    console.log(`[GuidedGenerations] Executing Custom Guide stscript`);

    // Use the context executeSlashCommandsWithOptions method
    if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
        const context = SillyTavern.getContext();
        try {
            // Send the combined script via context
            context.executeSlashCommandsWithOptions(stscriptCommand, { showOutput: false }); // Keep output hidden
            console.log('[GuidedGenerations] Custom Guide stscript executed.');
        } catch (error) {
            console.error(`[GuidedGenerations] Error executing Custom Guide: ${error}`);
        }
    }
};

// Export the function for use in the main extension file
export default customGuide;
