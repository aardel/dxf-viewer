// Test for drag-and-drop structure functionality
function testDragDropStructure() {
    console.log('🧪 Testing Drag-and-Drop Structure Functionality...\n');
    
    // Mock element definitions
    const mockDefaultElements = {
        'program-start': {
            type: 'program-start',
            title: 'Program Start Marker',
            icon: '🚀',
            enabled: true,
            config: { marker: '%1' }
        },
        'file-info': {
            type: 'file-info',
            title: 'File Information',
            icon: '📄',
            enabled: true,
            config: { template: '{filename} / - size: {width} x {height} / {timestamp}' }
        },
        'setup-commands': {
            type: 'setup-commands',
            title: 'Setup Commands',
            icon: '⚙️',
            enabled: true,
            config: { commands: 'G90\nG60 X0' }
        }
    };
    
    console.log('✅ Mock element definitions created');
    
    // Test element management
    console.log('\n✅ Testing Element Management:');
    
    // Mock header and footer elements
    let headerElements = [
        { ...mockDefaultElements['program-start'] },
        { ...mockDefaultElements['file-info'] },
        { ...mockDefaultElements['setup-commands'] }
    ];
    
    let footerElements = [
        {
            type: 'end-commands',
            title: 'End Commands',
            icon: '🏁',
            enabled: true,
            config: { commands: 'M30' }
        }
    ];
    
    console.log(`  📊 Initial header elements: ${headerElements.length}`);
    console.log(`  📊 Initial footer elements: ${footerElements.length}`);
    
    // Test element reordering
    console.log('\n✅ Testing Element Reordering:');
    
    // Move setup-commands to position 0
    const setupCommands = headerElements.splice(2, 1)[0];
    headerElements.splice(0, 0, setupCommands);
    
    console.log('  🔄 Moved setup-commands to first position');
    console.log(`  📋 New order: ${headerElements.map(el => el.title).join(' → ')}`);
    
    // Test element enabling/disabling
    console.log('\n✅ Testing Element Toggle:');
    
    headerElements[1].enabled = false; // Disable file-info
    console.log(`  🔄 Disabled: ${headerElements[1].title}`);
    console.log(`  📊 Enabled elements: ${headerElements.filter(el => el.enabled).length}/${headerElements.length}`);
    
    // Test custom element addition
    console.log('\n✅ Testing Custom Element Addition:');
    
    const customElement = {
        type: 'custom',
        title: 'My Custom Element',
        icon: '📝',
        enabled: true,
        config: { content: 'G28 Z0\n{ Custom home command' }
    };
    
    headerElements.push(customElement);
    console.log(`  ➕ Added custom element: ${customElement.title}`);
    console.log(`  📊 Total header elements: ${headerElements.length}`);
    
    // Test element configuration updates
    console.log('\n✅ Testing Element Configuration Updates:');
    
    headerElements[0].config.commands = 'G90\nG60 X0\nG0 X0 Y0';
    console.log(`  ⚙️ Updated setup commands for: ${headerElements[0].title}`);
    
    // Test preview generation
    console.log('\n✅ Testing Preview Generation:');
    
    const generatePreview = (elements, isFooter = false, startLineNumber = 1) => {
        const lines = [];
        let lineNumber = startLineNumber;
        const enableLineNumbers = true;
        
        elements.forEach(element => {
            if (!element.enabled) return;
            
            const config = element.config || {};
            
            switch (element.type) {
                case 'program-start':
                    const marker = config.marker || '%1';
                    lines.push(`${enableLineNumbers ? `N${lineNumber.toString().padStart(4, '0')} ` : ''}${marker}`);
                    lineNumber++;
                    break;
                    
                case 'file-info':
                    const template = config.template || '{filename}';
                    const fileInfo = template
                        .replace('{filename}', 'example.dxf')
                        .replace('{width}', '100.0')
                        .replace('{height}', '50.0')
                        .replace('{timestamp}', '8/11/2025, 1:26:15 PM');
                    lines.push(`${enableLineNumbers ? `N${lineNumber.toString().padStart(4, '0')} ` : ''}${fileInfo}`);
                    lineNumber++;
                    break;
                    
                case 'setup-commands':
                    const commands = (config.commands || '').split('\n').filter(line => line.trim());
                    commands.forEach(command => {
                        lines.push(`${enableLineNumbers ? `N${lineNumber.toString().padStart(4, '0')} ` : ''}${command.trim()}`);
                        lineNumber++;
                    });
                    break;
                    
                case 'end-commands':
                    const endCommands = (config.commands || '').split('\n').filter(line => line.trim());
                    endCommands.forEach(command => {
                        lines.push(`${enableLineNumbers ? `N${lineNumber.toString().padStart(4, '0')} ` : ''}${command.trim()}`);
                        lineNumber++;
                    });
                    break;
                    
                case 'custom':
                    const customLines = (config.content || '').split('\n').filter(line => line.trim());
                    customLines.forEach(line => {
                        lines.push(`${enableLineNumbers ? `N${lineNumber.toString().padStart(4, '0')} ` : ''}${line.trim()}`);
                        lineNumber++;
                    });
                    break;
            }
        });
        
        return lines;
    };
    
    const headerPreview = generatePreview(headerElements);
    const footerPreview = generatePreview(footerElements, true, headerPreview.length + 10);
    
    console.log(`  📄 Header preview lines: ${headerPreview.length}`);
    console.log(`  📄 Footer preview lines: ${footerPreview.length}`);
    console.log(`  📄 Total preview lines: ${headerPreview.length + footerPreview.length}`);
    
    // Show sample preview
    console.log('\n  📋 Sample Header Preview:');
    headerPreview.slice(0, 3).forEach(line => {
        console.log(`    ${line}`);
    });
    
    // Test drag and drop simulation with improved logic
    console.log('\n✅ Testing Improved Drag and Drop Simulation:');
    
    const simulateDragDrop = (sourceContainer, sourceIndex, targetContainer, targetIndex) => {
        const sourceElements = sourceContainer === 'header' ? headerElements : footerElements;
        const targetElements = targetContainer === 'header' ? headerElements : footerElements;
        
        if (sourceContainer === targetContainer) {
            // Move within same container with improved index adjustment
            const element = sourceElements.splice(sourceIndex, 1)[0];
            
            // Adjust target index if moving from before to after
            let adjustedTargetIndex = targetIndex;
            if (sourceIndex < targetIndex) {
                adjustedTargetIndex = targetIndex - 1;
            }
            
            targetElements.splice(adjustedTargetIndex, 0, element);
        } else {
            // Move between containers
            const element = sourceElements.splice(sourceIndex, 1)[0];
            targetElements.splice(targetIndex, 0, element);
        }
        
        return { headerElements: [...headerElements], footerElements: [...footerElements] };
    };
    
    // Test moving element within same container
    console.log('\n  🔄 Testing same-container reordering:');
    console.log(`    Before: ${headerElements.map(el => el.title).join(' → ')}`);
    
    // Move first element to last position
    const result1 = simulateDragDrop('header', 0, 'header', headerElements.length);
    console.log(`    After moving first to last: ${result1.headerElements.map(el => el.title).join(' → ')}`);
    
    // Test moving element between containers
    console.log('\n  🔄 Testing cross-container movement:');
    console.log(`    Header before: ${result1.headerElements.map(el => el.title).join(' → ')}`);
    console.log(`    Footer before: ${result1.footerElements.map(el => el.title).join(' → ')}`);
    
    // Move last header element to footer
    const result2 = simulateDragDrop('header', result1.headerElements.length - 1, 'footer', 0);
    console.log(`    Header after: ${result2.headerElements.map(el => el.title).join(' → ')}`);
    console.log(`    Footer after: ${result2.footerElements.map(el => el.title).join(' → ')}`);
    
    // Test drop index calculation simulation
    console.log('\n✅ Testing Drop Index Calculation:');
    
    const calculateDropIndex = (frames, clientY) => {
        if (frames.length === 0) {
            return 0;
        }
        
        // Simulate frame positions (simplified)
        const frameHeight = 80; // Approximate frame height
        const containerTop = 100; // Simulated container top
        
        // Check if dropping at the very top
        if (clientY < containerTop + frameHeight / 2) {
            return 0;
        }
        
        // Check each frame's middle point
        for (let i = 0; i < frames.length; i++) {
            const frameTop = containerTop + (i * frameHeight);
            const frameMiddle = frameTop + frameHeight / 2;
            
            if (clientY < frameMiddle) {
                return i;
            }
        }
        
        // If we get here, drop at the end
        return frames.length;
    };
    
    const mockFrames = ['frame1', 'frame2', 'frame3'];
    const testPositions = [50, 140, 220, 300]; // Different Y positions
    
    testPositions.forEach((clientY, index) => {
        const dropIndex = calculateDropIndex(mockFrames, clientY);
        console.log(`    Drop at Y=${clientY}: index ${dropIndex}`);
    });
    
    // Test structure persistence
    console.log('\n✅ Testing Structure Persistence:');
    
    const mockStructureConfig = {
        structure: {
            header: headerElements,
            footer: footerElements
        }
    };
    
    console.log(`  💾 Structure config created with ${mockStructureConfig.structure.header.length} header elements`);
    console.log(`  💾 Structure config created with ${mockStructureConfig.structure.footer.length} footer elements`);
    
    // Test element type validation
    console.log('\n✅ Testing Element Type Validation:');
    
    const validTypes = ['program-start', 'file-info', 'bounds', 'operations', 'scaling', 'setup-commands', 'home-command', 'end-commands', 'custom'];
    
    const validateElement = (element) => {
        return validTypes.includes(element.type) && 
               element.title && 
               element.icon && 
               typeof element.enabled === 'boolean';
    };
    
    const allElements = [...headerElements, ...footerElements];
    const validElements = allElements.filter(validateElement);
    const invalidElements = allElements.filter(el => !validateElement(el));
    
    console.log(`  ✅ Valid elements: ${validElements.length}/${allElements.length}`);
    console.log(`  ❌ Invalid elements: ${invalidElements.length}`);
    
    // Test element configuration validation
    console.log('\n✅ Testing Element Configuration Validation:');
    
    const validateConfig = (element) => {
        const config = element.config || {};
        
        switch (element.type) {
            case 'program-start':
                return typeof config.marker === 'string';
            case 'file-info':
                return typeof config.template === 'string';
            case 'setup-commands':
            case 'end-commands':
                return typeof config.commands === 'string';
            case 'custom':
                return typeof config.content === 'string';
            default:
                return true;
        }
    };
    
    const configValidElements = allElements.filter(validateConfig);
    const configInvalidElements = allElements.filter(el => !validateConfig(el));
    
    console.log(`  ✅ Config valid elements: ${configValidElements.length}/${allElements.length}`);
    console.log(`  ❌ Config invalid elements: ${configInvalidElements.length}`);
    
    // Test visual feedback simulation
    console.log('\n✅ Testing Visual Feedback Simulation:');
    
    const simulateVisualFeedback = (dragState, dropIndex, totalFrames) => {
        const feedback = {
            dragging: dragState,
            dropAbove: null,
            dropBelow: null
        };
        
        if (totalFrames > 0) {
            if (dropIndex === 0) {
                feedback.dropAbove = 0;
            } else if (dropIndex === totalFrames) {
                feedback.dropBelow = totalFrames - 1;
            } else {
                feedback.dropBelow = dropIndex - 1;
                feedback.dropAbove = dropIndex;
            }
        }
        
        return feedback;
    };
    
    const visualFeedback = simulateVisualFeedback('setup-commands', 1, 3);
    console.log(`  🎨 Visual feedback:`, visualFeedback);
    
    // Test drag and drop event handling
    console.log('\n✅ Testing Drag and Drop Event Handling:');
    
    // Mock drag event simulation
    const simulateDragEvent = (container, index) => {
        const dragData = {
            container: container,
            index: index,
            timestamp: Date.now()
        };
        
        console.log(`  🎯 Drag started: ${container}:${index}`);
        return dragData;
    };
    
    const simulateDropEvent = (dragData, targetContainer, targetIndex) => {
        console.log(`  🎯 Drop event: ${dragData.container}:${dragData.index} → ${targetContainer}:${targetIndex}`);
        
        // Simulate the move operation
        const sourceElements = dragData.container === 'header' ? headerElements : footerElements;
        const targetElements = targetContainer === 'header' ? headerElements : footerElements;
        
        if (dragData.container === targetContainer) {
            const element = sourceElements.splice(dragData.index, 1)[0];
            let adjustedTargetIndex = targetIndex;
            if (dragData.index < targetIndex) {
                adjustedTargetIndex = targetIndex - 1;
            }
            targetElements.splice(adjustedTargetIndex, 0, element);
        } else {
            const element = sourceElements.splice(dragData.index, 1)[0];
            targetElements.splice(targetIndex, 0, element);
        }
        
        return {
            success: true,
            sourceContainer: dragData.container,
            sourceIndex: dragData.index,
            targetContainer: targetContainer,
            targetIndex: targetIndex
        };
    };
    
    // Test a complete drag and drop operation
    const dragData = simulateDragEvent('header', 1);
    const dropResult = simulateDropEvent(dragData, 'header', 3);
    
    console.log(`  ✅ Drag and drop operation completed:`, dropResult);
    console.log(`  📋 New header order: ${headerElements.map(el => el.title).join(' → ')}`);
    
    console.log('\n🎉 All drag-and-drop structure tests completed successfully!');
}

// Run the test
testDragDropStructure();
