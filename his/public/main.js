document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Remove active class from all buttons and panes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked button and corresponding pane
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
    
    // Lab Request Form Submission
    const labRequestForm = document.getElementById('lab-request-form');
    const statusMessage = document.getElementById('status-message');
    
    labRequestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form values
        const patientName = document.getElementById('patientName').value;
        const patientId = document.getElementById('patientId').value;
        const patientAge = document.getElementById('patientAge').value;
        const patientGender = document.getElementById('patientGender').value;
        const patientWeight = document.getElementById('patientWeight').value;
        const doctorName = document.getElementById('doctorName').value;
        
        // Get selected tests
        const selectedTests = Array.from(document.querySelectorAll('input[name="tests"]:checked'))
            .map(checkbox => {
                return {
                    code: checkbox.value,
                    name: checkbox.nextElementSibling.textContent.trim()
                };
            });
            
        if (selectedTests.length === 0) {
            showStatus('Please select at least one laboratory test.', 'error');
            return;
        }
        
        try {
            // Send to server.js
            const response = await fetch('/api/lab-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    patientName,
                    patientId,
                    patientAge,
                    patientGender,
                    patientWeight,
                    doctorName,
                    testList: selectedTests
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create lab request');
            }
            
            // Show success message
            showStatus('Laboratory request sent successfully!', 'success');
            labRequestForm.reset();
            
        } catch (error) {
            console.error('Error submitting lab request:', error);
            showStatus('Error sending laboratory request. Please try again.', 'error');
        }
    });
    
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message';
        statusMessage.classList.add(type);
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            statusMessage.className = 'status-message';
        }, 5000);
    }
    
    // Fetch and display lab results
    const refreshResultsBtn = document.getElementById('refresh-results');
    const resultsList = document.getElementById('results-list');
    const searchDashboardInput = document.getElementById('search-results'); // Assuming this ID is for search
    
    refreshResultsBtn.addEventListener('click', fetchLabDashboardData);
    if (searchDashboardInput) {
        searchDashboardInput.addEventListener('input', filterDashboardItems);
    }
    
    let allDashboardItems = [];
    
    async function fetchLabDashboardData() {
        resultsList.innerHTML = '<p class="loading-message">Loading dashboard items...</p>';
        
        try {
            const response = await fetch('/api/lab-dashboard'); // Changed endpoint
            const data = await response.json();
            
            allDashboardItems = data.labDashboardItems || [];
            
            if (allDashboardItems.length === 0) {
                resultsList.innerHTML = '<p class="no-results">No lab requests or results found.</p>';
                return;
            }
            
            displayDashboardItems(allDashboardItems);
            
        } catch (error) {
            console.error('Error fetching lab dashboard items:', error);
            resultsList.innerHTML = '<p class="error-message">Error loading dashboard items. Please try again.</p>';
        }
    }
    
    function displayDashboardItems(items) {
        if (items.length === 0) {
            resultsList.innerHTML = '<p class="no-results">No matching results found.</p>';
            return;
        }
        
        resultsList.innerHTML = ''; // Clear previous items
        
        items.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.className = 'dashboard-item-card'; // Base class for styling, including border
            
            let primaryStatusLabel = ''; // Will be "Complete", "Pending", etc.
            let primaryStatusClass = ''; // For text color: 'success', 'pending', 'error', 'warning'
            let itemCardClassSuffix = ''; // For border color: 'result', 'pending', 'error', 'warning'
            let specificDetailsContent = ''; // HTML string for content after the primary status line

            // Common header for patient and request details
            let content = `<h4>Patient: ${item.patientName || 'N/A'} (ID: ${item.patientId || 'N/A'})</h4>`;
            content += `<p>Requested by: Dr. ${item.doctorName || 'N/A'}</p>`;
            content += `<p>Requested at: ${item.requestedAt ? new Date(item.requestedAt).toLocaleString() : 'N/A'}</p>`;

            // Determine primary status, class, and specific content based on item type
            if (item.type === 'result') {
                const lowerStatusMsg = item.statusMessage ? item.statusMessage.toLowerCase() : '';

                if (lowerStatusMsg.includes('final') || lowerStatusMsg.includes('amended') || lowerStatusMsg.includes('corrected')) {
                    primaryStatusLabel = 'Complete';
                    primaryStatusClass = 'success';
                    itemCardClassSuffix = 'result'; // For green border
                } else if (lowerStatusMsg.includes('preliminary') || lowerStatusMsg.includes('partial') || lowerStatusMsg.includes('registered')) {
                    primaryStatusLabel = 'Pending';
                    primaryStatusClass = 'pending';
                    itemCardClassSuffix = 'pending'; // For yellow border
                } else if (lowerStatusMsg.includes('cancelled') || lowerStatusMsg.includes('entered-in-error')) {
                    primaryStatusLabel = 'Cancelled/Error';
                    primaryStatusClass = 'error';
                    itemCardClassSuffix = 'error'; // For red border
                } else { 
                    primaryStatusLabel = 'Complete'; // Default for 'result' if status is unclear but report exists
                    primaryStatusClass = 'success';
                    itemCardClassSuffix = 'result'; // For green border
                }

                const effectiveDate = item.effectiveDate ? new Date(item.effectiveDate).toLocaleDateString() : 'Unknown date';
                specificDetailsContent = `
                    <p>Tests Ordered: ${item.testsOrdered || 'N/A'}</p>
                    <p>Effective Date: ${effectiveDate}</p>
                    ${item.conclusion ? `<p><strong>Conclusion:</strong> ${item.conclusion}</p>` : ''}
                    ${item.resultsDisplay ? `<div><strong>Test Details:</strong><p>${item.resultsDisplay.replace(/;\s*/g, '<br>')}</p></div>` : ''}
                    <p><small><em>Lab's Detailed Status: ${item.statusMessage || 'N/A'}</em></small></p>
                    
                `;
            } else if (item.type === 'pending_on_fhir') {
                itemCardClassSuffix = 'pending';
                primaryStatusLabel = 'Pending';
                primaryStatusClass = 'pending';
                specificDetailsContent = `
                    <p>Tests Ordered: ${item.tests || 'N/A'}</p>
                    <p><small><em>Details: ${item.statusMessage || 'Awaiting lab processing'}</em></small></p>
                    
                `;
            } else if (item.type === 'pending_local_error' || item.type === 'pending_fhir_comms_error') {
                itemCardClassSuffix = 'error';
                primaryStatusLabel = 'Pending (System Error)';
                primaryStatusClass = 'error';
                specificDetailsContent = `
                    <p>Tests Ordered: ${item.tests || 'N/A'}</p>
                    <p><small><em>Details: ${item.statusMessage || 'Error in request processing'}</em></small></p>
                    ${item.details ? `<p><small><em>Info: ${item.details}</em></small></p>` : ''}
                    
                `;
            } else if (item.type === 'completed_no_report') {
                itemCardClassSuffix = 'warning';
                primaryStatusLabel = 'Complete (Report Not Found)';
                primaryStatusClass = 'warning';
                specificDetailsContent = `
                    <p>Tests Ordered: ${item.tests || 'N/A'}</p>
                    <p><small><em>Details: ${item.statusMessage || 'Lab request is marked complete, but report is missing.'}</em></small></p>
                    ${item.details ? `<p><small><em>Info: ${item.details}</em></small></p>` : ''}
                    
                `;
            } else {
                itemCardClassSuffix = 'unknown';
                primaryStatusLabel = 'Unknown Status';
                primaryStatusClass = 'unknown';
                specificDetailsContent = `<p>No specific details available for this item type. ${item.statusMessage ? `(${item.statusMessage})` : ''}</p>`;
            }
            
            itemCard.classList.add(`${itemCardClassSuffix}-item`); // e.g., result-item, pending-item for border styling

            // Add the prominent primary status line
            content += `<p class="status-message ${primaryStatusClass}"><strong>Status:</strong> ${primaryStatusLabel}</p>`;
            // Add the rest of the specific details
            content += specificDetailsContent;

            itemCard.innerHTML = content;
            resultsList.appendChild(itemCard);
        });
    }
    
    function filterDashboardItems() {
        const searchTerm = searchDashboardInput.value.toLowerCase();
        
        if (!searchTerm.trim()) {
            displayDashboardItems(allDashboardItems);
            return;
        }
        
        const filteredItems = allDashboardItems.filter(item => {
            const patientNameMatch = item.patientName && item.patientName.toLowerCase().includes(searchTerm);
            const patientIdMatch = item.patientId && item.patientId.toLowerCase().includes(searchTerm);
            const doctorNameMatch = item.doctorName && item.doctorName.toLowerCase().includes(searchTerm);
            const testsMatch = (item.tests && item.tests.toLowerCase().includes(searchTerm)) || 
                               (item.testsOrdered && item.testsOrdered.toLowerCase().includes(searchTerm));
            const statusMatch = item.statusMessage && item.statusMessage.toLowerCase().includes(searchTerm);

            return patientNameMatch || patientIdMatch || doctorNameMatch || testsMatch || statusMatch;
        });
        
        displayDashboardItems(filteredItems);
    }
    
    // Initial fetch of lab results when viewing the results tab
    document.querySelector('[data-tab="results"]').addEventListener('click', () => {
        // Fetch data every time the tab is clicked to ensure freshness,
        // or implement a check if data is already loaded and not stale.
        fetchLabDashboardData();
    });

    // If the "Results" tab is active by default, fetch data on load
    // Check if the results tab element exists and if it has the active class
    const resultsTabButton = document.querySelector('.tab-btn[data-tab="results"]');
    if (resultsTabButton && resultsTabButton.classList.contains('active')) {
        fetchLabDashboardData();
    } else if (allDashboardItems.length === 0 && tabPanes.length > 0 && !document.querySelector('.tab-pane.active')) {
        // If no tab is active by default, and results tab is the first one, you might want to load it.
        // For now, we'll rely on the click event or an explicitly active tab.
        // Or, if the results tab is the default active one (e.g. first tab)
        const firstTabPane = document.querySelector('.tab-pane');
        if (firstTabPane && firstTabPane.id === 'results-tab') { // Ensure 'results-tab' is the ID of the results pane
             fetchLabDashboardData();
        }
    }
});